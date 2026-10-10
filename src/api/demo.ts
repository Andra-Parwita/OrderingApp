// Plan 013: sample orders on a demo kitchen. The server takes the kitchen from the session and
// answers 403 unless it is a demo kitchen; these are not the dev tools.
import {
  parseClearSamplesResponse,
  parseSampleOrdersResponse,
  type ClearSamplesResponse,
  type SampleOrdersResponse,
} from '../../shared/devContract';
import { request, type ApiResult } from './http';

export function addDemoSamples(): Promise<ApiResult<SampleOrdersResponse>> {
  return request('/api/seller/demo/samples', parseSampleOrdersResponse, { method: 'POST' });
}

export function clearDemoSamples(): Promise<ApiResult<ClearSamplesResponse>> {
  return request('/api/seller/demo/samples', parseClearSamplesResponse, { method: 'DELETE' });
}
