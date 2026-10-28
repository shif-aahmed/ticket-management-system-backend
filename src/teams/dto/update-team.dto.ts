import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Team name cannot exceed 100 characters' })
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  teamLeadId?: string | null;

  @IsOptional()
  @IsString()
  colorClass?: string;

  @IsOptional()
  @IsString()
  bgClass?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
