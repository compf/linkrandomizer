import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { signal } from "@angular/core";
import { getRandomFacts } from "@linkrandomizer/common";
@Component({
    selector: 'app-random-facts',
    templateUrl: './random-facts.html',
    styleUrls: ['./random-facts.css'],
    standalone: true,
    imports: [CommonModule, FormsModule]
})
export class RandomFactsComponent {
    facts=signal<string[]>([])
    count:number=10;
    topic:string="";
    constructor(){
       
    }
    async getFacts(){
        this.facts.set(await getRandomFacts(this.topic, this.count))
    }
}