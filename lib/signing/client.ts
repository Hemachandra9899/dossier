// Legacy signing client entry point.
//
// Re-exports the Documenso client factory from
// modules/signing/providers/documenso/client.ts so existing call sites keep
// working unchanged. The Documenso SDK import lives ONLY in the provider
// module; this file no longer imports @documenso/sdk-typescript.

export {
  getDocumensoClient as getSigningClient,
  getDocumensoHost as getSigningHost,
  getDocumensoApiUrl as getSigningApiUrl,
  getDocumensoWebhookSecret as getSigningWebhookSecret,
} from "@/modules/signing/provider/documenso/client";
