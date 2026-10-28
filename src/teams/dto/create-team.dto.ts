import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty({ message: 'Team name is required' })
  @MaxLength(100, { message: 'Team name cannot exceed 100 characters' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  teamLeadId?: string;

  @IsOptional()
  @IsString()
  colorClass?: string;

  @IsOptional()
  @IsString()
  bgClass?: string;
}
