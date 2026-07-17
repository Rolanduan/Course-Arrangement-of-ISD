/**
 * Netlify Function - API 网关
 * 将所有 API 请求路由到对应的处理函数
 */

import { Handler } from '@netlify/functions';
import { apiHandler } from '../../server/api-handler.js';

export const handler: Handler = async (event, context) => {
  // 处理 CORS 预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
      },
      body: ''
    };
  }

  // 构建模拟的 Request 和 Response 对象
  const method = event.httpMethod;
  const path = event.path || event.rawUrl;
  const body = event.body ? JSON.parse(event.body) : {};
  const headers = event.headers || {};
  const queryStringParameters = event.queryStringParameters || {};

  try {
    const result = await apiHandler({
      method,
      path,
      body,
      headers,
      query: queryStringParameters
    });

    return {
      statusCode: result.status || 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result.data)
    };
  } catch (error: any) {
    return {
      statusCode: error.status || 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: error.message || 'Internal Server Error'
      })
    };
  }
};
