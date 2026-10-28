import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class CreateAttachmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Attachment filename is required' })
  filename: string;

  @IsString()
  @IsNotEmpty({ message: 'Attachment mimeType is required' })
  mimeType: string;

  @IsInt({ message: 'Attachment size must be an integer in bytes' })
  @Min(1, { message: 'File size must be greater than 0 bytes' })
  @Max(50 * 1024 * 1024, { message: 'File size cannot exceed 50MB' })
  size: number;

  @IsString()
  @IsNotEmpty({ message: 'Attachment storageKey reference is required' })
  storageKey: string;
}
