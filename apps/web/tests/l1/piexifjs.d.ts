// Deklarasi minimal untuk piexifjs (devDependency, hanya dipakai membuat fixture tes).
declare module "piexifjs" {
  const piexif: {
    ImageIFD: Record<string, number>;
    ExifIFD: Record<string, number>;
    GPSIFD: Record<string, number>;
    GPSHelper: { degToDmsRational(deg: number): number[][] };
    dump(exif: Record<string, unknown>): string;
    insert(exifBinary: string, jpegBinary: string): string;
  };
  export default piexif;
}
