// github-stats.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, catchError, map, shareReplay } from 'rxjs';

export interface ContributionDay {
  contributionCount: number;
  date: string;
  weekday: number;
}

export interface GitHubStats {
  username: string;
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
  avatarUrl: string;
  followers: number;
  following: number;
  repositories: number;
}

@Injectable({
  providedIn: 'root'
})
export class GitHubStatsService {
  private cache = new Map<string, Observable<GitHubStats>>();
  private readonly CURRENT_YEAR = new Date().getFullYear();
  private readonly WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  private readonly MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  constructor(private http: HttpClient) {}

  getGitHubStats(username: string, githubToken: string): Observable<GitHubStats> {
    if (!username) {
      return throwError(() => new Error('Username is required'));
    }

    if (!githubToken) {
      return throwError(() => new Error('GitHub token is required'));
    }

    if (this.cache.has(username)) {
      return this.cache.get(username)!;
    }

    const stats$ = this.fetchGitHubData(username, githubToken).pipe(
      map(userData => this.processGitHubData(username, userData)),
      catchError(this.handleError),
      shareReplay(1)
    );

    this.cache.set(username, stats$);
    return stats$;
  }

  private fetchGitHubData(username: string, token: string): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const query = `
      query($username: String!) {
        user(login: $username) {
          avatarUrl
          followers { totalCount }
          following { totalCount }
          repositories { totalCount }
          contributionsCollection(from: "${this.CURRENT_YEAR}-01-01T00:00:00Z", to: "${this.CURRENT_YEAR}-12-31T23:59:59Z") {
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

    return this.http.post(
      'https://api.github.com/graphql',
      { query, variables: { username } },
      { headers }
    );
  }

  private processGitHubData(username: string, userData: any): GitHubStats {
    const user = userData.data.user;
    const contributions = user.contributionsCollection.contributionCalendar;
    const contributionDays = contributions.weeks.flatMap((week: any) => week.contributionDays);

    // Calculate monthly commits
    const monthlyCommits: Record<string, number> = {};
    contributionDays.forEach((day: ContributionDay) => {
      const month = new Date(day.date).getMonth();
      monthlyCommits[month] = (monthlyCommits[month] || 0) + day.contributionCount;
    });

    // Calculate daily commits
    const dailyCommits: Record<number, number> = {};
    contributionDays.forEach((day: ContributionDay) => {
      dailyCommits[day.weekday] = (dailyCommits[day.weekday] || 0) + day.contributionCount;
    });

    // Find most active month and day
    const mostActiveMonth = Object.entries(monthlyCommits).sort((a, b) => b[1] - a[1])[0];
    const mostActiveDay = Object.entries(dailyCommits).sort((a, b) => b[1] - a[1])[0];

    // Calculate stars
    const totalStars = user.repositories.nodes.reduce((sum: number, repo: any) => sum + repo.stargazerCount, 0);

    // Calculate top languages
    const languages: Record<string, number> = {};
    user.repositories.nodes.forEach((repo: any) => {
      if (repo.primaryLanguage?.name) {
        languages[repo.primaryLanguage.name] = (languages[repo.primaryLanguage.name] || 0) + 1;
      }
    });
    const topLanguages = Object.entries(languages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang]) => lang);

    // Calculate streaks
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

    return {
      username,
      longestStreak: maxStreak,
      totalCommits: contributions.totalContributions,
      commitRank: this.getCommitRank(contributions.totalContributions),
      calendarData: contributionDays,
      mostActiveDay: {
        name: this.WEEKDAY_NAMES[parseInt(mostActiveDay[0])],
        commits: Math.round(mostActiveDay[1] / 52) // Average per week
      },
      mostActiveMonth: {
        name: this.MONTH_NAMES[parseInt(mostActiveMonth[0])],
        commits: mostActiveMonth[1]
      },
      starsEarned: totalStars,
      topLanguages,
      avatarUrl: user.avatarUrl,
      followers: user.followers.totalCount,
      following: user.following.totalCount,
      repositories: user.repositories.totalCount
    };
  }

  private getCommitRank(totalCommits: number): string {
    if (totalCommits >= 5000) return "Godlike 🚀";
    if (totalCommits >= 2000) return "Elite 💻";
    if (totalCommits >= 1000) return "Pro 🔥";
    if (totalCommits >= 500) return "Active 🏃";
    if (totalCommits >= 200) return "Regular 👍";
    if (totalCommits >= 50) return "Casual ☕";
    return "Newbie 🌱";
  }

  private handleError(error: HttpErrorResponse) {
    console.error('GitHub API error:', error);

    let errorMessage = 'Failed to fetch GitHub statistics';
    if (error.status === 401) {
      errorMessage = 'Invalid GitHub token. Please check your token and try again.';
    } else if (error.status === 403) {
      errorMessage = 'API rate limit exceeded. Please try again later.';
    } else if (error.status === 404) {
      errorMessage = 'GitHub user not found. Please check the username.';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    return throwError(() => new Error(errorMessage));
  }
}
