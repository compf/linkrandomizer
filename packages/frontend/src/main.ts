import 'zone.js';
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideNativeDateAdapter } from '@angular/material/core';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UrlExplorerComponent } from './components/url-explorer/url-explorer';
import { WebsiteAnalyzerComponent } from './components/website-analyzer.component/website-analyzer.component';
import { ElectronService } from '@linkrandomizer/common';
import { FrontendUrlHandler } from './frontend-handler/frontend-url-handler';
import { FrontendWebsiteHandler } from './frontend-handler/frontend-website-handler';
import { FrontendTaskHandler } from './frontend-handler/frontend-task-handler';
import { FrontendAnnotationHandler } from './frontend-handler/frontend-annotation-handler';
import { FrontendService } from './frontend-handler/frontend-service';
import { RandomFactsComponent } from './components/random-facts/random-facts';
import { WeeklyTasksComponent } from './components/weekly-tasks/weekly-tasks';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';

if(window.isElectron){
  console.log("Running in electron");
} else {
  const service:ElectronService={
    invokeFromBackend:{
      ...FrontendUrlHandler.invokeFromBackend,
      ...FrontendWebsiteHandler.invokeFromBackend,
      ...FrontendTaskHandler.invokeFromBackend,
      ...FrontendAnnotationHandler.invokeFromBackend
    },
    eventFromBackend:{
      ...FrontendUrlHandler.eventFromBackend,
      ...FrontendWebsiteHandler.eventFromBackend,
      ...FrontendTaskHandler.eventFromBackend,
      ...FrontendAnnotationHandler.eventFromBackend
    },
    sendToBackend:{
      ...FrontendUrlHandler.sendToBackend,
      ...FrontendWebsiteHandler.sendToBackend,
      ...FrontendTaskHandler.sendToBackend,
      ...FrontendAnnotationHandler.sendToBackend
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
    UrlExplorerComponent,
    WebsiteAnalyzerComponent,
    RandomFactsComponent,
    WeeklyTasksComponent,
  ]
})
class App implements OnInit {
  frontendService = inject(FrontendService);

  ngOnInit() {
    console.log('App initialized with IPC:', window.api);
  }
}

bootstrapApplication(App, {
  providers: [provideNativeDateAdapter()],
}).catch(err => console.error(err));

