import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddTeamMemberDto {
  @IsString()
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;

  @IsOptional()
  @IsString()
  role?: string = 'member';
}
