import { handleAIRequest } from '../../server/handler.cjs';

export function POST(request) {
  return handleAIRequest(request, '/financial-chat');
}

export function OPTIONS(request) {
  return handleAIRequest(request, '/financial-chat');
}
