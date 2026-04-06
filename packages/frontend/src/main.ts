import 'zone.js';
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { generateRandomURL, GroupedURl, myFunction, Website } from '@linkrandomizer/common';
import { GeneratedURL } from '@linkrandomizer/common';
import { GroupByVariables } from '@linkrandomizer/common';
import {MatTreeModule} from '@angular/material/tree';
import {MatIconModule} from '@angular/material/icon';
import { FlatTreeControl, NestedTreeControl } from '@angular/cdk/tree';
const textValue = myFunction({ id: 2, name: 'Angular' });
console.log('frontend.myFunction ->', textValue);

@Component({
  selector: 'app-url-generator',
  templateUrl: './url-generator.component.html',
  styleUrls: ['./url-generator.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, MatTreeModule,MatIconModule]
})
class UrlGeneratorComponent implements OnInit {
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
    console.log("urls",urls)
    return [...subNodes, ...urls];
  }
  treeControl = new NestedTreeControl<GroupedURl|GeneratedURL>(node => this.childrenAccessor(node));

  getNodeLabel(node: GroupedURl | GeneratedURL): string {
    if ('groupKey' in node) {
      return node.groupKey;
    } else if ('url' in node) {
      console.log("is url")
      return node.url;
    }
    console.warn("Unknown node type:", node);
    return '';
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
  

  openUrl(url: string) {
    (window as any).api.sendToBackend.openUrlInBrowser({ url });
  }
}

@Component({
  selector: 'app-website-analyzer',
  templateUrl: './website-analyzer.component.html',
  styleUrls: ['./website-analyzer.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
class WebsiteAnalyzerComponent implements OnInit {
  websiteUrl = '';
  isAnalyzing = false;
  analysisStatus = '';
  analyzedSchemas: any[] = [];

  ngOnInit() {
    (window as any).api.eventFromBackend.websiteAnalysisComplete((schemas: any[]) => {
      this.analyzedSchemas = schemas;
      this.isAnalyzing = false;
      this.analysisStatus = 'Complete';
    });

    (window as any).api.eventFromBackend.websiteAnalysisStatus((status: string) => {
      this.analysisStatus = status;
      if (status === 'analysis_started') {
        this.isAnalyzing = true;
      }
      if (status === 'analysis_done' || status === 'analysis_error') {
        this.isAnalyzing = false;
      }
    });
  }

  analyzeWebsite() {
    if (this.websiteUrl) {
      this.isAnalyzing = true;
      this.analysisStatus = 'Sending request...';
     window.api.sendToBackend.analyzeWebsite({ url: this.websiteUrl, existingLinks: [] });
    }
  }

  getSchemaPreview(schema: any): string {
    // Simple preview of the schema
    return schema.schema.map((part: any) => typeof part === 'string' ? part : `{${part.variable}}`).join('');
  }
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, UrlGeneratorComponent, WebsiteAnalyzerComponent]
})
class App implements OnInit {
  activeTab = 'generator';

  ngOnInit() {
    console.log('App initialized with IPC:', window.api);
  }
}

bootstrapApplication(App).catch(err => console.error(err));
