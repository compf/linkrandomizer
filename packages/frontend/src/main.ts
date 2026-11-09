import 'zone.js';
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideNativeDateAdapter } from '@angular/material/core';
import { Component, ElementRef, HostListener, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UrlExplorerComponent } from './components/url-explorer/url-explorer';
import { WebsiteAnalyzerComponent } from './components/website-analyzer.component/website-analyzer.component';
import { ElectronService } from '@linkrandomizer/common';
import { FrontendUrlHandler, getStoredApiKey, setStoredApiKey } from './frontend-handler/frontend-url-handler';
import { FrontendWebsiteHandler } from './frontend-handler/frontend-website-handler';
import { FrontendTaskHandler } from './frontend-handler/frontend-task-handler';
import { FrontendAnnotationHandler } from './frontend-handler/frontend-annotation-handler';
import { FrontendService } from './frontend-handler/frontend-service';
import { RandomFactsComponent } from './components/random-facts/random-facts';
import { WeeklyTasksComponent } from './components/weekly-tasks/weekly-tasks';
import { YoutubeRandomizerComponent } from './components/youtube-randomizer/youtube-randomizer';
import { FrontendYoutubeHandler } from './frontend-handler/frontend-youtube-handler';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

if(window.isElectron){
  console.log("Running in electron");
} else {
  const service:ElectronService={
    invokeFromBackend:{
      ...FrontendUrlHandler.invokeFromBackend,
      ...FrontendWebsiteHandler.invokeFromBackend,
      ...FrontendTaskHandler.invokeFromBackend,
      ...FrontendAnnotationHandler.invokeFromBackend,
      ...FrontendYoutubeHandler.invokeFromBackend
    },
    eventFromBackend:{
      ...FrontendUrlHandler.eventFromBackend,
      ...FrontendWebsiteHandler.eventFromBackend,
      ...FrontendTaskHandler.eventFromBackend,
      ...FrontendAnnotationHandler.eventFromBackend,
      ...FrontendYoutubeHandler.eventFromBackend
    },
    sendToBackend:{
      ...FrontendUrlHandler.sendToBackend,
      ...FrontendWebsiteHandler.sendToBackend,
      ...FrontendTaskHandler.sendToBackend,
      ...FrontendAnnotationHandler.sendToBackend,
      ...FrontendYoutubeHandler.sendToBackend
    }
  }
  window.api=service;
  console.log("Running in browser");
}





@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    UrlExplorerComponent,
    WebsiteAnalyzerComponent,
    RandomFactsComponent,
    WeeklyTasksComponent,
    YoutubeRandomizerComponent,
  ]
})
class App implements OnInit {
  frontendService = inject(FrontendService);
  @ViewChild('apiKeyInput') apiKeyInput?: ElementRef<HTMLInputElement>;

  settingsOpen = false;
  showApiKey = false;
  apiKeyDraft = '';

  ngOnInit() {
    if (!this.frontendService.isElectron) {
      this.apiKeyDraft = getStoredApiKey();
    }
    console.log('App initialized with IPC:', window.api);
  }

  toggleSettings() {
    this.settingsOpen = !this.settingsOpen;
    if (this.settingsOpen) {
      setTimeout(() => this.apiKeyInput?.nativeElement.focus());
    }
  }

  closeSettings() {
    this.settingsOpen = false;
    this.showApiKey = false;
  }

  onApiKeyChange(value: string) {
    this.apiKeyDraft = value;
    setStoredApiKey(value);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeSettings();
  }
}

bootstrapApplication(App, {
  providers: [provideNativeDateAdapter()],
}).catch(err => console.error(err));

