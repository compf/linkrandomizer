export type ProjectTreeItem={
    name:string,
    path:string,
    children:ProjectTreeItem[],
    isFolder:boolean

}