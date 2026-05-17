import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import { provideServiceTestbed } from '../testing/test-providers';

describe('AppComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: provideServiceTestbed(),
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    httpMock.expectOne('/api/playlist').flush([]);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render Spooty in the hero title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    httpMock.expectOne('/api/playlist').flush([]);
    fixture.detectChanges();
    httpMock.expectOne('/api/auth/spotify/status').flush({ linked: true });
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.title span')?.textContent).toContain('Spooty');
  });

  it('should validate Spotify URLs', () => {
    const fixture = TestBed.createComponent(AppComponent);
    httpMock.expectOne('/api/playlist').flush([]);
    const app = fixture.componentInstance;
    app.url = 'https://open.spotify.com/playlist/abc123';
    expect(app.isValidSpotifyUrl).toBe(true);
    app.url = 'not-a-url';
    expect(app.isValidSpotifyUrl).toBe(false);
  });
});
