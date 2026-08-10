import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import {
  buildWeeklyProposals,
  getIsoWeek,
  ProposedTask,
  setTaskChecked,
  TaskCompletions,
  WEEKLY_PROPOSAL_COUNT,
} from "@linkrandomizer/common";

@Component({
  selector: "app-weekly-tasks",
  templateUrl: "./weekly-tasks.html",
  styleUrls: ["./weekly-tasks.css"],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCheckboxModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
})
export class WeeklyTasksComponent implements OnInit {
  readonly proposalCount = WEEKLY_PROPOSAL_COUNT;

  year = getIsoWeek().year;
  weekOfYear = getIsoWeek().weekOfYear;
  proposals = signal<ProposedTask[]>([]);
  saveError = signal("");
  loading = signal(true);

  private completions: TaskCompletions = {};

  async ngOnInit() {
    await this.reload();
  }

  async reload() {
    this.loading.set(true);
    this.saveError.set("");
    try {
      this.completions = (await window.api.invokeFromBackend.loadTaskCompletions()) ?? {};
      this.refreshProposals();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.saveError.set(message);
      this.proposals.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  onWeekChange() {
    this.year = Math.trunc(Number(this.year)) || getIsoWeek().year;
    this.weekOfYear = Math.min(53, Math.max(1, Math.trunc(Number(this.weekOfYear)) || 1));
    this.refreshProposals();
  }

  goToCurrentWeek() {
    const current = getIsoWeek();
    this.year = current.year;
    this.weekOfYear = current.weekOfYear;
    this.refreshProposals();
  }

  shiftWeek(delta: number) {
    let week = this.weekOfYear + delta;
    let year = this.year;
    while (week < 1) {
      week += 52;
      year -= 1;
    }
    while (week > 52) {
      week -= 52;
      year += 1;
    }
    this.year = year;
    this.weekOfYear = week;
    this.refreshProposals();
  }

  async onCheckedChange(task: ProposedTask, checked: boolean) {
    this.completions = setTaskChecked(
      this.completions,
      task.name,
      this.year,
      this.weekOfYear,
      checked,
    );
    this.refreshProposals();
    const result = await window.api.invokeFromBackend.saveTaskCompletions(this.completions);
    if (result.ok === false) {
      this.saveError.set(result.error);
      return;
    }
    this.saveError.set("");
  }

  private refreshProposals() {
    this.proposals.set(buildWeeklyProposals(this.completions, this.year, this.weekOfYear));
  }
}
