import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IsBoolean, IsEmail, IsNotEmpty, IsString } from 'class-validator';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @IsString()
  @IsNotEmpty()
  @Column({ unique: true })
  username: string;

  @IsEmail()
  @IsNotEmpty()
  @Column({ unique: true })
  email: string;

  @IsString()
  @Column()
  fullname: string;

  @IsBoolean()
  @Column({ default: false })
  required_duo: boolean;

  @IsBoolean()
  @Column({ default: false })
  duo_verified: boolean;

  @IsBoolean()
  @Column({ default: false })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
