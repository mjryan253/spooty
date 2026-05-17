import { EnvironmentProviders, Provider } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Socket } from 'ngx-socket-io';

export const mockSocket = {
  on: (): void => {},
  emit: (): void => {},
  removeListener: (): void => {},
};

/** HttpClient testing + mock Socket for root-provided services. */
export function provideServiceTestbed(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    { provide: Socket, useValue: mockSocket },
  ];
}
