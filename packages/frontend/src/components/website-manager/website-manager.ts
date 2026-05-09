import { Component, inject, OnInit, signal } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from "@angular/material/dialog";
import { MatFormField } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { getTagsForWebsites, Website } from "@linkrandomizer/common/dist/models/website_schemas";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

@Component({
  selector: 'app-website-manager',
  templateUrl: './website-manager.html',
  styleUrls: ['./website-manager.css'],
  standalone: true,
  imports: [MatDialogContent, MatFormField, MatInput, MatButton, 
    MatDialogActions,
    MatIcon, CommonModule, FormsModule]
})
export class WebsiteManager implements OnInit {

    public websites = signal<Website[]>([]);
    public currEditingWebsite = signal<Website | null>(null);
    public allTags = signal<string[]>([]);
    private dialogRef=inject(MatDialog)

    async ngOnInit() {
       window.api.invokeFromBackend.getAvailableWebsites().then((websites: Website[]) => {
            this.websites.set(websites);
            this.allTags.set(getTagsForWebsites(websites));
       });
    }

    toggleWebsiteTag(website: Website, tag: string) {
        if (website.tags.includes(tag)) {
            website.tags = website.tags.filter(t => t !== tag);
        } else {
            website.tags = [...website.tags, tag];
        }
    }

    addSelectionValue(variable: any) {
        variable.values = [...(variable.values || []), ""];
    }

    removeSelectionValue(variable: any, index: number) {
        variable.values = variable.values.filter((_: any, i: number) => i !== index);
    }
    	protected readonly reference = inject(MatDialogRef<WebsiteManager>);

    saveChanges() {
        window.api.invokeFromBackend.saveWebsites(this.websites());
        this.reference.close();
    }
}