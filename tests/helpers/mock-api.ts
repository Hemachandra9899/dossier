import type { NextApiRequest, NextApiResponse } from "next";

export type MockApiResponse = NextApiResponse & {
  statusCode: number;
  body: unknown;
};

export function mockReq(
  overrides: Partial<NextApiRequest> = {},
): NextApiRequest {
  return {
    method: "GET",
    query: {},
    ...overrides,
  } as NextApiRequest;
}

export function mockRes(): MockApiResponse {
  const res = {
    statusCode: 200,
    body: null as unknown,

    status(this: MockApiResponse, code: number) {
      res.statusCode = code;
      return res;
    },
    json(this: MockApiResponse, payload: unknown) {
      res.body = payload;
      return res;
    },
    setHeader(this: MockApiResponse) {
      return res;
    },
    end(this: MockApiResponse) {
      return res;
    },
  };

  return res as unknown as MockApiResponse;
}
