import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GithubWrappedComponent } from './github-wrapped.component';

describe('GithubWrappedComponent', () => {
  let component: GithubWrappedComponent;
  let fixture: ComponentFixture<GithubWrappedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GithubWrappedComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GithubWrappedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
