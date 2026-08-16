// /signing/prepare/:requestId — sender's full-page field-authoring screen for a
// signature request. The URL carries no teamId; the request row owns it, so
// membership is verified server-side here (survives hard refresh).

import { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/shared/utils/auth/auth-options";
import prisma from "@/shared/utils/prisma";

import { SignaturePreparePage } from "@/features/signing/ui/signature-prepare-page";
import { NativeSignaturePreparePage } from "@/features/signing/ui/native-signature-prepare-page";

const EDITABLE_STATUSES = ["DRAFT", "PREPARING", "READY"];

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const requestId = context.query.requestId as string | undefined;
  if (!requestId) {
    return { notFound: true };
  }

  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const user = session.user as { id?: string } | undefined;
  if (!user?.id) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const request = await prisma.signatureRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      teamId: true,
      documentId: true,
      status: true,
      provider: true,
      document: { select: { name: true } },
    },
  });

  if (!request) {
    return { notFound: true };
  }

  const membership = await prisma.team.findUnique({
    where: { id: request.teamId, users: { some: { userId: user.id } } },
    select: { id: true },
  });

  if (!membership) {
    return { notFound: true };
  }

  if (!EDITABLE_STATUSES.includes(request.status)) {
    return {
      redirect: {
        destination: `/documents/${request.documentId}`,
        permanent: false,
      },
    };
  }

  return {
    props: {
      teamId: request.teamId,
      requestId: request.id,
      documentId: request.documentId,
      documentName: request.document?.name ?? "Document",
      provider: request.provider,
    },
  };
};

export default function SignaturePreparePageWrapper({
  teamId,
  requestId,
  documentId,
  documentName,
  provider,
}: {
  teamId: string;
  requestId: string;
  documentId: string;
  documentName: string;
  provider: "NATIVE" | "DOCUMENSO";
}) {
  if (provider === "NATIVE") {
    return (
      <NativeSignaturePreparePage
        teamId={teamId}
        requestId={requestId}
        documentId={documentId}
        documentName={documentName}
      />
    );
  }

  return (
    <SignaturePreparePage
      teamId={teamId}
      requestId={requestId}
      documentId={documentId}
      documentName={documentName}
    />
  );
}
