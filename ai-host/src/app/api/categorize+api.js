import { handleAIRequest } from '../../server/handler.cjs';

export function POST(request) {
  return handleAIRequest(request, '/categorize');
}

export function OPTIONS(request) {
  return handleAIRequest(request, '/categorize');
}
