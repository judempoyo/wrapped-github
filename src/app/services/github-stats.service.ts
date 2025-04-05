// github-stats.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../environments/environment';

interface ContributionDay {
  contributionCount: number;
  date: string;
  weekday: number;
}

export interface GitHubStats {
  longestStreak: number;
  totalCommits: number;
  commitRank: string;
  calendarData: ContributionDay[];
  mostActiveDay: {
    name: string;
    commits: number;
  };
  mostActiveMonth: {
    name: string;
    commits: number;
  };
  starsEarned: number;
  topLanguages: string[];
}

@Injectable({
  providedIn: 'root'
})
export class GitHubStatsService {
  private readonly WEEKDAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ] as const;

  private readonly MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ] as const;

  constructor(private http: HttpClient) {}

  /**
   * Fetches GitHub statistics for a given username
   * @param username GitHub username
   * @returns Observable with GitHub stats
   */
  getGitHubStats(username: string): Observable<GitHubStats> {
    if (!username) {
      return throwError(() => new Error('Username is required'));
    }

    // In a real app, you would call your backend API here
    // For demonstration, we'll simulate the processing
    return this.fetchGitHubData(username).pipe(
      map(userData => this.processGitHubData(userData)),
      catchError(this.handleError)
    );
  }

  /**
   * Simulates fetching data from GitHub API
   * In a real app, this should be a call to your backend
   */
  private fetchGitHubData(username: string): Observable<any> {
    // Note: In a production app, you should call your backend API
    // that has the GitHub token, not call GitHub directly from Angular
    const headers = {};

    if (environment.githubToken) {
      headers['Authorization'] = `token ${environment.githubToken}`;
    }

    const query = `
      query($username: String!) {
        user(login: $username) {
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  contributionCount
                  date
                  weekday
                }
              }
            }
          }
          repositories(first: 100, orderBy: {field: STARGAZERS, direction: DESC}) {
            nodes {
              stargazerCount
              primaryLanguage {
                name
              }
            }
          }
        }
      }
    `;

    return this.http.post('https://api.github.com/graphql', {
      query,
      variables: { username }
    }, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Processes raw GitHub data into formatted statistics
   */
  private processGitHubData(userData: any): GitHubStats {
    // Process contribution data for the current year
    const contributionDays = userData.data.user.contributionsCollection.contributionCalendar.weeks
      .flatMap((week: any) => week.contributionDays)
      .filter((day: any) => new Date(day.date) >= new Date(`${new Date().getFullYear()}-01-01`));

    // Calculate monthly contribution statistics
    const monthlyCommits: Record<string, number> = {};
    contributionDays.forEach((day: ContributionDay) => {
      const month = new Date(day.date).getMonth() + 1;
      const monthKey = month.toString().padStart(2, "0");
      monthlyCommits[monthKey] = (monthlyCommits[monthKey] || 0) + day.contributionCount;
    });

    // Calculate daily contribution patterns
    const dailyCommits: Record<string, number> = {};
    contributionDays.forEach((day: ContributionDay) => {
      dailyCommits[day.weekday] = (dailyCommits[day.weekday] || 0) + day.contributionCount;
    });

    // Find peak activity periods
    const [mostActiveMonth] = Object.entries(monthlyCommits).sort(([, a], [, b]) => b - a);
    const [mostActiveDay] = Object.entries(dailyCommits).sort(([, a], [, b]) => b - a);

    // Calculate repository statistics
    const totalStars = userData.data.user.repositories.nodes.reduce(
      (acc: number, repo: any) => acc + repo.stargazerCount, 0
    );

    // Process programming language statistics
    const languages = userData.data.user.repositories.nodes.reduce(
      (acc: Record<string, number>, repo: any) => {
        if (repo.primaryLanguage?.name) {
          acc[repo.primaryLanguage.name] = (acc[repo.primaryLanguage.name] || 0) + 1;
        }
        return acc;
      }, {}
    );

    const topLanguages = Object.entries(languages)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([lang]) => lang);

    // Calculate contribution streaks
    let currentStreak = 0;
    let maxStreak = 0;
    for (const day of contributionDays) {
      if (day.contributionCount > 0) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    const totalCommits = userData.data.user.contributionsCollection.contributionCalendar.totalContributions;

    return {
      longestStreak: maxStreak,
      totalCommits,
      commitRank: this.getCommitRank(totalCommits),
      calendarData: contributionDays,
      mostActiveDay: {
        name: this.WEEKDAY_NAMES[parseInt(mostActiveDay[0])],
        commits: Math.round(mostActiveDay[1] / (contributionDays.length / 7)), // Average per day
      },
      mostActiveMonth: {
        name: this.MONTH_NAMES[parseInt(mostActiveMonth[0]) - 1],
        commits: mostActiveMonth[1],
      },
      starsEarned: totalStars,
      topLanguages,
    };
  }

  /**
   * Determines the user's commit rank based on their total number of contributions
   */
  private getCommitRank(totalCommits: number): string {
    if (totalCommits >= 5000) return "Top 0.5%-1%";
    if (totalCommits >= 2000) return "Top 1%-3%";
    if (totalCommits >= 1000) return "Top 5%-10%";
    if (totalCommits >= 500) return "Top 10%-15%";
    if (totalCommits >= 200) return "Top 25%-30%";
    if (totalCommits >= 50) return "Median 50%";
    return "Bottom 30%";
  }

  /**
   * Handles HTTP errors
   */
  private handleError(error: HttpErrorResponse) {
    console.error('GitHub API error:', error);
    let errorMessage = 'Failed to fetch GitHub statistics';

    if (error.status === 404) {
      errorMessage = 'GitHub user not found';
    } else if (error.status === 403) {
      errorMessage = 'API rate limit exceeded';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    return throwError(() => new Error(errorMessage));
  }
}
