import { NestedTreeControl } from "@angular/cdk/tree";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatTreeModule } from "@angular/material/tree";
import { Website, GroupedURl, GeneratedURL, generateRandomURL, GroupByVariables } from "@linkrandomizer/common";
import { ChatDialogComponent } from "../chat.component/chat.component";
import { Component, inject, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-url-generator',
  templateUrl: './url-generator.component.html',
  styleUrls: ['./url-generator.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, MatTreeModule,MatIconModule]
})
export class UrlGeneratorComponent implements OnInit {
  allWebsites=signal<Website[]>([])
  allTags=signal<string[]>([])
  selectedTags: { [key: string]: boolean } = {};
  urlCount = 1000;
  groupedUrls=signal<GroupedURl[]>([{
    groupKey:"",
    groupValue:"All URLs",
    children:[],
    urls:[]
  }]);


  hasChild = (_: number, node: GroupedURl) => {
    
    return !!node.children && node.children.length > 0 || !!node.urls && node.urls.length > 0;};

  childrenAccessor = (node: GroupedURl | GeneratedURL) => {
    const subNodes=(node as GroupedURl)?.children ?? []
    const urls=(node as GroupedURl)?.urls ?? []
    return [...subNodes, ...urls];
  }
  treeControl = new NestedTreeControl<GroupedURl|GeneratedURL>(node => this.childrenAccessor(node));

  getNodeLabel(node: GroupedURl | GeneratedURL): string {
    if ('groupKey' in node) {
      return node.groupValue;
    } else if ('url' in node) {
      return node.url;
    }
    console.warn("Unknown node type:", node);
    return '';
  }

  getTotalUrlCount(node: GroupedURl): number {
    const directUrls = node.urls?.length ?? 0;
    const nestedUrls = node.children?.reduce((sum, child) => sum + this.getTotalUrlCount(child), 0) ?? 0;
    return directUrls + nestedUrls;
  }

  async ngOnInit() {
     await this.loadWebsites();

     await this.loadTags();

    for(const tag of this.allTags()){
      this.selectedTags[tag]=true;
    }
    await this.generateUrls();
    
   
  }

  async loadWebsites() {
    try {
      this.allWebsites.set( await (window as any).api.invokeFromBackend.getAvailableWebsites());
    } catch (error) {
      console.error('Error loading websites:', error);
    }
  }
  async toggleTagFilter(tag: string, isChecked: boolean) {
    this.selectedTags[tag] = isChecked;
    
    await this.generateUrls();
  }

  async loadTags() {
   const tags: Set<string> = new Set();
    try {
      const websites: Website[] = await (window as any).api.invokeFromBackend.getAvailableWebsites();
      console.log("Websites for tag extraction:", websites);
      websites.forEach(website => website.tags.forEach(tag => tags.add(tag)));
      this.allTags.set(Array.from(tags));
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }

  async filterWebsites() {
    const selectedTagList = Object.keys(this.selectedTags).filter(tag => this.selectedTags[tag]);
    console.log("Filtering websites with selected tags:", selectedTagList);
    if(selectedTagList.length === 0){
      console.warn("No tags selected, returning empty website list");
     return []
    }
    try {
      const filteredWebsites=this.allWebsites().filter(w => selectedTagList.some(t => w.tags.includes(t)))
      console.log("filtered websites:", filteredWebsites)
      return filteredWebsites;
      return 
    } catch (error) {
      console.error('Error filtering websites:', error);
    }
  }

  async generateUrls() {
    try{
    console.log("started generating URLs with count:", this.urlCount);
    const generated: GeneratedURL[] = [];
    const  filteredWebsites=await this.filterWebsites();
    if(filteredWebsites.length===0){
        this.groupedUrls.set([{
          groupKey:"",
          groupValue:"No URLs generated",
          children:[],
          urls:[]
        }])
      console.warn("No websites match the selected tags, skipping URL generation");
      return;
    }
    for(let i=0;i<this.urlCount;i++){
      const randomWebsite=filteredWebsites[Math.floor(Math.random()*filteredWebsites.length)]
      const url=generateRandomURL(randomWebsite);
      generated.push(url);
    }
    const grouper=new GroupByVariables(["year","month"]);
    const grouped=grouper.group(generated);
    console.log("Generated URLs grouped:", grouped);
    this.groupedUrls.set([grouped]);
  }  catch(error){
    console.error("Error generating URLs:", error);
  }
  }

  private dialog=inject(MatDialog)
  

  openUrl(url: string) {
    (window as any).api.sendToBackend.openUrlInBrowser({ url });
  }
  openChatDialog(url: GeneratedURL) {
    console.log("Opening chat dialog for URL:", url);
    this.dialog.open(ChatDialogComponent, {
      data: url
    });
  }
}