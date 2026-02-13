import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Contact, Prisma } from '@crm/db';
import { PaginatedResult } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { QueryContactDto } from './dto/query-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContactDto): Promise<Contact> {
    const account = await this.prisma.account.findUnique({ where: { id: dto.accountId } });
    if (!account) throw new NotFoundException(`Account ${dto.accountId} not found`);

    try {
      return await this.prisma.contact.create({
        data: {
          accountId: dto.accountId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Contact with this email may already exist for this account');
      }
      throw e;
    }
  }

  async findAll(query: QueryContactDto): Promise<PaginatedResult<Contact>> {
    const { page = 1, pageSize = 20, name, accountId, email, sortBy = 'createdAt', sortDir = 'desc' } = query;

    const and: Prisma.ContactWhereInput[] = [];
    if (accountId) and.push({ accountId });
    if (email) and.push({ email: { contains: email, mode: 'insensitive' } });
    if (name) {
      and.push({
        OR: [
          { firstName: { contains: name, mode: 'insensitive' } },
          { lastName: { contains: name, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.ContactWhereInput = and.length ? { AND: and } : {};

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return { data, page, pageSize, total };
  }

  async findOne(id: string): Promise<Contact> {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException(`Contact ${id} not found`);
    return contact;
  }

  async update(id: string, dto: UpdateContactDto): Promise<Contact> {
    await this.findOne(id);
    try {
      return await this.prisma.contact.update({
        where: { id },
        data: dto,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Contact with this email may already exist');
      }
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.contact.delete({ where: { id } });
  }
}
