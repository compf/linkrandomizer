import { NestedTreeControl } from "@angular/cdk/tree";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { MatSelectModule } from "@angular/material/select";
import { MatIconModule } from "@angular/material/icon";
import { MatTreeModule } from "@angular/material/tree";
import { MatCardModule } from "@angular/material/card";
import { MatExpansionModule } from "@angular/material/expansion";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import {
  Website,
  GroupedURl,
  GeneratedURL,
  generateRandomURL,
  UrlGrouper,
  NoGrouping,
  publicWebsites,
  loadExtractedUrls,
  availableGroupers,
  getTagsForWebsites,
  ItemRanker,
  RankerName,
  createRanker,
  rankerNames,
  pickWebsiteByRank,
  sortGroupedUrls,
  defaultDateProximityConfig,
  defaultTagRankerConfig,
} from "@linkrandomizer/common";
import { ChatDialogComponent } from "../chat.component/chat.component";
import { Component, inject, OnInit, signal } from '@angular/core';
@Component({
  selector: 'app-url-generator',
  templateUrl: './url-generator.component.html',
  styleUrls: ['./url-generator.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTreeModule,
    MatIconModule,
    MatSelectModule,
    MatCardModule,
    MatExpansionModule,
    MatCheckboxModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ]
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

  protected rankerNames = rankerNames;
  selectedRankerName: RankerName = "No ranking";
  targetYear = defaultDateProximityConfig().targetYear;
  targetMonth = defaultDateProximityConfig().targetMonth ?? 1;
  tagPriority: string[] = [];
  aiPreferences = "";
  aiRankTarget: "url" | "website" | "both" = "both";
  aiRankScript = "";
  aiRankLoading = false;
  aiRankError = "";

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
    this.tagPriority = [...this.allTags()];
    this.ranker = this.buildRanker();
    await this.generateUrls();
    
   
  }

  async loadWebsites() {
    try {
      await loadExtractedUrls();
      this.allWebsites.set(publicWebsites);
    } catch (error) {
      console.error('Error loading websites:', error);
    }
  }
  async toggleTagFilter(tag: string, isChecked: boolean) {
    this.selectedTags[tag] = isChecked;
    
    await this.generateUrls();
  }

  async loadTags() {
    try {
      const websites: Website[] = publicWebsites;
      this.allTags.set(getTagsForWebsites(websites));
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
    } catch (error) {
      console.error('Error filtering websites:', error);
      return [];
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
    this.ranker = this.buildRanker();
    for(let i=0;i<this.urlCount;i++){
      const website = pickWebsiteByRank(filteredWebsites, this.ranker);
      const url=generateRandomURL(website);
      generated.push(url);
    }
    const grouper=this.grouper;
    const grouped=grouper.group(generated);
    const rankedGrouped = sortGroupedUrls(grouped, this.ranker);
    console.log("Generated URLs grouped:", rankedGrouped);
    this.groupedUrls.set([rankedGrouped]);
  }  catch(error){
    console.error("Error generating URLs:", error);
  }
  }

  private dialog=inject(MatDialog)
  protected grouperNames=Object.keys(availableGroupers)
  private grouper:UrlGrouper=new NoGrouping()
  private ranker: ItemRanker = createRanker("No ranking");

  protected changeGrouper(name:string){
  this.grouper=availableGroupers[name as keyof typeof availableGroupers]
  this.generateUrls()
  }

  protected changeRanker(name: RankerName) {
    this.selectedRankerName = name;
    this.generateUrls();
  }

  protected onRankingConfigChange() {
    this.generateUrls();
  }

  protected moveTagUp(index: number) {
    if (index <= 0) {
      return;
    }
    const next = [...this.tagPriority];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    this.tagPriority = next;
    this.onRankingConfigChange();
  }

  protected moveTagDown(index: number) {
    if (index >= this.tagPriority.length - 1) {
      return;
    }
    const next = [...this.tagPriority];
    [next[index + 1], next[index]] = [next[index], next[index + 1]];
    this.tagPriority = next;
    this.onRankingConfigChange();
  }

  protected async generateAiRanker() {
    if (!this.aiPreferences.trim()) {
      this.aiRankError = "Describe what you want to rank first.";
      return;
    }

    this.aiRankLoading = true;
    this.aiRankError = "";
    try {
      this.aiRankScript = await window.api.invokeFromBackend.generateRankScript({
        preferences: this.aiPreferences,
        target: this.aiRankTarget,
      });
      this.selectedRankerName = "AI custom";
      await this.generateUrls();
    } catch (error) {
      this.aiRankError = error instanceof Error ? error.message : String(error);
    } finally {
      this.aiRankLoading = false;
    }
  }

  private buildRanker(): ItemRanker {
    return createRanker(this.selectedRankerName, {
      dateProximity: {
        targetYear: this.targetYear,
        targetMonth: this.targetMonth,
      },
      tagPriority: defaultTagRankerConfig(this.tagPriority),
      ai: {
        script: this.aiRankScript,
        target: this.aiRankTarget,
      },
    });
  }
  

  openUrl(url: string) {
    (window as any).api.sendToBackend.openUrlInBrowser({ url });
  }
  openChatDialog(url: GeneratedURL) {
    console.log("Opening chat dialog for URL:", url);
    this.dialog.open(ChatDialogComponent, {
      data: url
    });
  }

 randomUrl() {
  const targetIndex=Math.floor(Math.random()*this.urlCount);
  this.randomURlRecu(this.groupedUrls()[0], 0, targetIndex);
 }

 private randomURlRecu(url:GroupedURl, currIndex:number, targetIndex:number): number{
  for(const u of url.urls){
    if(currIndex>=targetIndex){
      this.openUrl(u.url);
      this.openChatDialog(u);
      return -10;
    }
    currIndex++;
  }
  for(const g of url.children ?? []){
    currIndex=this.randomURlRecu(g, currIndex, targetIndex); 
  }
  return currIndex;
 }
}
