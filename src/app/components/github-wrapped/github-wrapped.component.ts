import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, finalize } from 'rxjs/operators';
import { ContributionDay, GitHubStats, GitHubStatsService } from '../../services/github-stats.service';
import { throwError } from 'rxjs';

@Component({
  selector: 'app-github-wrapped',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './github-wrapped.component.html',
  styleUrls: ['./github-wrapped.component.css']
})
export class GitHubWrappedComponent implements OnInit {
  private githubStatsService = inject(GitHubStatsService);

  username = '';
  githubToken = '';
  stats: GitHubStats | null = null;
  loading = false;
  error: string | null = null;
  currentYear = new Date().getFullYear();
  showTokenInput = false;

  // Données pour le calendrier
  weeks: any[] = [];
  monthLabels: {index: number, name: string}[] = [];
  colorScale = [
    { count: 0, color: 'bg-gray-100' },
    { count: 1, color: 'bg-green-200' },
    { count: 3, color: 'bg-green-300' },
    { count: 5, color: 'bg-green-400' },
    { count: 10, color: 'bg-green-500' }
  ];

  ngOnInit() {
    this.generateMonthLabels();
  }

  fetchStats() {
    if (!this.username) {
      this.error = 'Please enter a GitHub username';
      return;
    }

    if (!this.githubToken) {
      this.error = 'GitHub token is required';
      return;
    }

    this.loading = true;
    this.error = null;
    this.stats = null;

    this.githubStatsService.getGitHubStats(this.username, this.githubToken)
      .pipe(
        catchError(err => {
          this.error = err.message;
          return throwError(() => err);
        }),
        finalize(() => this.loading = false)
      )
      .subscribe(stats => {
        this.stats = stats;
        this.prepareCalendarData(stats.calendarData);
      });
  }

  private prepareCalendarData(days: ContributionDay[]) {
    this.weeks = [];
    let currentWeek: any[] = [];
    let lastMonth = -1;

    days.forEach(day => {
      const date = new Date(day.date);
      const month = date.getMonth();

      if (month !== lastMonth) {
        this.monthLabels.push({
          index: currentWeek.length,
          name: date.toLocaleString('default', { month: 'short' })
        });
        lastMonth = month;
      }

      currentWeek.push({
        date: day.date,
        count: day.contributionCount,
        month: month
      });

      if (date.getDay() === 6 || day.date === days[days.length - 1].date) {
        this.weeks.push(currentWeek);
        currentWeek = [];
      }
    });
  }

  private generateMonthLabels() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    this.monthLabels = months.map((name, index) => ({
      name,
      index: Math.floor((index * 30.5) / 7)
    }));
  }

  getColorClass(count: number): string {
    return this.colorScale.find(scale => count <= scale.count)?.color || this.colorScale[this.colorScale.length - 1].color;
  }

  toggleTokenInput() {
    this.showTokenInput = !this.showTokenInput;
  }
}
