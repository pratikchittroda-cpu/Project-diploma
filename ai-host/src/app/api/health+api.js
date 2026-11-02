import { healthResponse } from '../../server/handler.cjs';

export function GET() {
  return healthResponse();
}
