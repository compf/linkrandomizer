import 'zone.js';
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { generateRandomURL, myFunction, Website } from '@linkrandomizer/common';

const textValue = myFunction({ id: 2, name: 'Angular' });
console.log('frontend.myFunction ->', textValue);

@Component({
  selector: 'app-url-generator',
  templateUrl: './url-generator.component.html',
  styleUrls: ['./url-generator.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
class UrlGeneratorComponent implements OnInit {
  allWebsites=signal<Website[]>([])
  allTags=signal<string[]>([])
  selectedTags: { [key: string]: boolean } = {};
  urlCount = 100;
  generatedUrls=signal<string[]>([]);


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
     return []
    }
    try {
      const filteredWebsites=this.allWebsites().filter(w => selectedTagList.every(t => w.tags.includes(t)))
      console.log("filtered websites:", filteredWebsites)
      return filteredWebsites;
      return 
    } catch (error) {
      console.error('Error filtering websites:', error);
    }
  }

  async generateUrls() {
    this.generatedUrls.set([]);
    const  filteredWebsites=await this.filterWebsites();
    if(filteredWebsites.length===0){
      return;
    }
    for(let i=0;i<this.urlCount;i++){
      const randomWebsite=filteredWebsites[Math.floor(Math.random()*filteredWebsites.length)]
      const url=generateRandomURL(randomWebsite);
      this.generatedUrls.update(urls=>[...urls,url])
    }
    // this.generatedUrls.set(generated);
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
