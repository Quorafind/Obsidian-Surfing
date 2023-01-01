import { moment, prepareFuzzySearch } from "obsidian";
import {
	Button,
	Checkbox,
	Col,
	ConfigProvider,
	Input,
	Modal,
	Row,
	Space,
	Table,
	Tag,
	theme,
} from "antd";
import React, { KeyboardEventHandler, useEffect, useState } from "react";
import { generateColor, generateTagsOptions, stringToCategory } from "./utils";
import type { Bookmark, CategoryType } from "../../types/bookmark";
import { ColumnsType } from "antd/es/table";
import { CheckboxValueType } from "antd/es/checkbox/Group";
import { BookmarkForm } from "./BookmarkForm";
import SurfingPlugin from "src/surfingIndex";
import { saveJson } from "../../utils/json";
import { SurfingView } from "../../surfingView";

const columnOptions = [
	"name",
	"description",
	"category",
	"tags",
	"created",
	"modified",
];

const emptyBookmark = {
	id: "",
	name: "",
	description: "",
	url: "",
	tags: "",
	category: [""],
	created: moment().valueOf(),
	modified: moment().valueOf(),
};

interface Props {
	bookmarks: Bookmark[];
	categories: CategoryType[];
	plugin: SurfingPlugin;
}

export default function BookmarkManager(props: Props) {
	const [bookmarks, setBookmarks] = useState(props.bookmarks);
	const options = generateTagsOptions(bookmarks);
	const [currentBookmark, setCurrentBookmark] = useState(emptyBookmark);
	const [searchWord, setSearchWord] = useState("");


	const defaultColumns: ColumnsType<Bookmark> = [
		{
			title: "name",
			dataIndex: "name",
			key: "name",
			render: (text, record) => {
				return <a href={ record.url } onClick={
					(e) => {
						e.preventDefault();
						SurfingView.spawnWebBrowserView(true, {
							url: record.url,
						})
					}
				}>{ text }</a>;
			},
			sorter: (a, b) => {
				return a.name.localeCompare(b.name);
			},
		},
		{
			title: "description",
			dataIndex: "description",
			key: "description",
			onFilter: (value, record) => {
				return record.description.indexOf(value as string) === 0;
			},
		},
		{
			title: "url",
			dataIndex: "url",
			key: "url",
		},
		{
			title: "category",
			dataIndex: "category",
			key: "category",
			render: (value) => {
				if (value[0] === "") {
					return <p></p>;
				}
				return <p>{ value.join(">") }</p>;
			},
			filters: stringToCategory(
				props.plugin.settings.bookmarkManager.category
			) as any,
			onFilter: (value, record) => {
				return record.category.includes(value as string);
			},
		},
		{
			title: "tags",
			dataIndex: "tags",
			key: "tags",
			render: (text: string) => {
				if (!text) return "";
				return text.split(" ").map((tag: string) => {
					const color = generateColor(tag);
					return (
						<Tag color={ color } key={ tag }>
							{ tag.toUpperCase() }
						</Tag>
					);
				});
			},
			filters: options.tagsOptions,
			onFilter: (value, record) => {
				return record.tags.indexOf(value as string) === 0;
			},
		},
		{
			title: "created",
			dataIndex: "created",
			key: "created",
			render: (text: number) => {
				return <p>{ moment(text).format("YYYY-MM-DD") }</p>;
			},
			sorter: (a, b) => a.created - b.created,
		},
		{
			title: "modified",
			dataIndex: "modified",
			key: "modified",
			render: (text: number) => {
				return <p>{ moment(text).format("YYYY-MM-DD") }</p>;
			},
			sorter: (a, b) => a.modified - b.modified,
		},
		{
			title: "Action",
			key: "action",
			render: (text, record) => (
				<Space size="middle">
					<a
						onClick={ () => {
							setCurrentBookmark(record);
							setModalVisible(true);
						} }
					>
						Edit
					</a>
					<a
						onClick={ () => {
							handleDeleteBookmark(record);
						} }
					>
						Delete
					</a>
				</Space>
			),
		},
	];

	const [columns, setColumns] = useState(defaultColumns);
	const [checkedColumn, setCheckedColumn] = useState<CheckboxValueType[]>(
		props.plugin.settings.bookmarkManager.defaultColumnList
	);

	const CheckboxGroup = Checkbox.Group;
	const onColumnChange = async (list: CheckboxValueType[]) => {
		const newColumns = defaultColumns.filter((column) => {
			return list.includes(column.title as string);
		});
		setColumns(newColumns);
		setCheckedColumn(list);
		props.plugin.settings.bookmarkManager.defaultColumnList = list as any;
		await props.plugin.saveSettings();
	};
	const [modalVisible, setModalVisible] = useState(false);

	const handleSearch = (value: string) => {
		if (value === undefined) value = searchWord;

		const query = prepareFuzzySearch(value);

		if (value === "") {
			setBookmarks(props.bookmarks);
		} else {
			const filteredBookmarks = props.bookmarks.filter((bookmark) => {
				return (
					query(bookmark.name
						.toLocaleLowerCase())?.score ||
					query(bookmark.description
						.toLocaleLowerCase())?.score
				);
			});
			setBookmarks(filteredBookmarks);
		}

		setSearchWord(value);
	};

	const handleCancelSearch: KeyboardEventHandler<HTMLInputElement> = (
		event
	) => {
		if (event.key === "Escape") {
			setBookmarks(props.bookmarks);
			setSearchWord("");
		}
	};

	const handleAddBookmark = () => {
		setCurrentBookmark(emptyBookmark);
		setModalVisible(true);
	};

	const handleDeleteBookmark = (oldBookmark: Bookmark) => {
		let newBookmarks = JSON.parse(JSON.stringify(bookmarks));

		for (let i = 0; i < bookmarks.length; i++) {
			if (bookmarks[i].id === oldBookmark.id) {
				newBookmarks.splice(i, 1);
				setBookmarks(newBookmarks);
				break;
			}
		}

		saveJson({
			bookmarks: newBookmarks,
			categories: props.categories,
		});
	};

	const handleModalOk = () => {
		setCurrentBookmark(emptyBookmark);
		setModalVisible(false);
	};

	const handleModalCancel = () => {
		setCurrentBookmark(emptyBookmark);
		setModalVisible(false);
	};

	const handleSaveBookmark = (newBookmark: Bookmark, previousId: string) => {
		const isBookmarkExist = props.bookmarks.some((bookmark, index) => {
			if (bookmark.url === newBookmark.url || bookmark.id === previousId) {
				bookmarks[index] = newBookmark;
				setBookmarks(bookmarks);

				setModalVisible(false);
				setCurrentBookmark(emptyBookmark);

				return true;
			} else {
				return false;
			}
		});

		if (!isBookmarkExist) {
			bookmarks.push(newBookmark);
			setBookmarks(bookmarks);
			setModalVisible(false);
		}

		saveJson({
			bookmarks: bookmarks,
			categories: props.categories,
		});
	};

	return (
		<div className="surfing-bookmark-manager">
			<ConfigProvider
				theme={ {
					algorithm:
						app.getTheme() === "obsidian"
							? theme.darkAlgorithm
							: theme.defaultAlgorithm,
				} }
			>
				<div className="surfing-bookmark-manager-header-bar">
					<Row gutter={ [16, 16] }>
						<Col span={ 12 }>
							<div className="surfing-bookmark-manager-search-bar">
								<Input
									value={ searchWord }
									onChange={ (e) => {
										handleSearch(e.target.value);
									} }
									defaultValue={ searchWord }
									placeholder={ `Search from ${ bookmarks.length } bookmarks` }
									onPressEnter={ (e) => {
										handleSearch(e.currentTarget.value);
									} }
									onKeyDown={ handleCancelSearch }
									allowClear
								/>
								<Button onClick={ handleAddBookmark }>+</Button>
							</div>
						</Col>
						<Col span={ 6 } style={ { marginTop: "5px" } }>
							<CheckboxGroup
								options={ columnOptions }
								value={ checkedColumn }
								onChange={ onColumnChange }
							/>
						</Col>
					</Row>
				</div>
				<Table
					dataSource={ bookmarks }
					key={ new Date().toISOString() }
					columns={ columns }
					pagination={ {
						defaultPageSize: Number(
							props.plugin.settings.bookmarkManager.pagination
						),
						position: ["bottomCenter"],
					} }
					scroll={ {
						y: 'calc(100vh - 14em)',
						x: 'max-content'
					} }
					rowKey="id"
				></Table>
				<Modal
					title="Bookmark"
					key={ currentBookmark.id }
					keyboard={ true }
					open={ modalVisible }
					onOk={ handleModalOk }
					onCancel={ handleModalCancel }
					footer={ [null] }
				>
					<BookmarkForm
						bookmark={ currentBookmark }
						options={ options }
						handleSaveBookmark={ handleSaveBookmark }
						categories={ props.categories }
					></BookmarkForm>
				</Modal>
			</ConfigProvider>
		</div>
	);
}
