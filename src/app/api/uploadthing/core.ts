import { createUploadthing, type FileRouter } from 'uploadthing/next';

const f = createUploadthing();

export const ourFileRouter = {
  conversationAttachment: f({
    image: { maxFileSize: '32MB', maxFileCount: 10 },
    video: { maxFileSize: '256MB', maxFileCount: 5 },
    pdf: { maxFileSize: '64MB', maxFileCount: 10 },
    blob: { maxFileSize: '128MB', maxFileCount: 10 }
  })
    .middleware(async () => {
      return { source: 'kiaro-commissions' };
    })
    .onUploadComplete(async ({ file }) => {
      const uploadedFile = file as unknown as {
        name?: string;
        size?: number;
        key?: string;
        url?: string;
        appUrl?: string;
        ufsUrl?: string;
      };

      return {
        name: uploadedFile.name || file.name,
        size: uploadedFile.size || file.size,
        key: uploadedFile.key || file.key,
        url: uploadedFile.ufsUrl || uploadedFile.url || uploadedFile.appUrl || ''
      };
    })
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
