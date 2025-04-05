import { TestBed } from '@angular/core/testing';

import { GithubStatsService } from './github-stats.service';

describe('GithubStatsService', () => {
  let service: GithubStatsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GithubStatsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
