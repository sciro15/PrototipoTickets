import { PrismaClient, Priority, Role, Status } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Seed idempotente: usa upsert para usuarios (por email) y solo crea un
 * ticket de demostración si no existe ya uno con el mismo título.
 * Se puede ejecutar varias veces sin duplicar datos.
 */
const prisma = new PrismaClient();

const users = [
  { name: 'Ana Admin', email: 'ana.admin@solucionesandinas.test', role: Role.ADMIN },
  { name: 'Carlos Soporte', email: 'carlos.soporte@solucionesandinas.test', role: Role.SOPORTE },
  { name: 'Sofía Soporte', email: 'sofia.soporte@solucionesandinas.test', role: Role.SOPORTE },
  { name: 'Luis Solicitante', email: 'luis.solicitante@solucionesandinas.test', role: Role.SOLICITANTE },
  { name: 'María Solicitante', email: 'maria.solicitante@solucionesandinas.test', role: Role.SOLICITANTE },
];

interface DemoTicket {
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: Status;
  requester: string;
  assignee?: string;
  // Recorrido de estados desde ABIERTO hasta el estado actual
  path: Status[];
}

const tickets: DemoTicket[] = [
  {
    title: 'La impresora del piso 2 no imprime',
    description: 'La impresora compartida muestra error de papel atascado, pero no hay papel atascado.',
    category: 'Hardware',
    priority: Priority.MEDIA,
    status: Status.ABIERTO,
    requester: 'luis.solicitante@solucionesandinas.test',
    path: [],
  },
  {
    title: 'No puedo acceder al correo corporativo',
    description: 'Desde esta mañana el correo rechaza mi contraseña aunque no la he cambiado.',
    category: 'Accesos',
    priority: Priority.ALTA,
    status: Status.EN_PROGRESO,
    requester: 'maria.solicitante@solucionesandinas.test',
    assignee: 'carlos.soporte@solucionesandinas.test',
    path: [Status.EN_PROGRESO],
  },
  {
    title: 'Servidor de archivos caído',
    description: 'Nadie en contabilidad puede abrir las carpetas compartidas.',
    category: 'Infraestructura',
    priority: Priority.CRITICA,
    status: Status.RESUELTO,
    requester: 'luis.solicitante@solucionesandinas.test',
    assignee: 'sofia.soporte@solucionesandinas.test',
    path: [Status.EN_PROGRESO, Status.RESUELTO],
  },
  {
    title: 'Instalación de Office en equipo nuevo',
    description: 'Se requiere instalar la suite ofimática en el portátil recién asignado.',
    category: 'Software',
    priority: Priority.BAJA,
    status: Status.CERRADO,
    requester: 'maria.solicitante@solucionesandinas.test',
    assignee: 'sofia.soporte@solucionesandinas.test',
    path: [Status.EN_PROGRESO, Status.RESUELTO, Status.CERRADO],
  },
  {
    title: 'Solicitud de acceso a VPN',
    description: 'Necesito acceso a la VPN para trabajo remoto la próxima semana.',
    category: 'Accesos',
    priority: Priority.MEDIA,
    status: Status.ABIERTO,
    requester: 'luis.solicitante@solucionesandinas.test',
    path: [],
  },
];

async function main() {
  const byEmail = new Map<string, number>();
  const demoPassword = process.env.SEED_PASSWORD ?? 'Demo1234!';
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      // Reasigna la contraseña demo (también repara usuarios migrados con hash vacío)
      update: { passwordHash },
      create: { ...u, passwordHash },
    });
    byEmail.set(u.email, user.id);
  }

  let created = 0;
  for (const t of tickets) {
    const exists = await prisma.ticket.findFirst({ where: { title: t.title } });
    if (exists) continue;

    const assigneeId = t.assignee ? byEmail.get(t.assignee) : undefined;
    await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          title: t.title,
          description: t.description,
          category: t.category,
          priority: t.priority,
          status: t.status,
          requesterId: byEmail.get(t.requester)!,
          assigneeId,
        },
      });
      let previous: Status = Status.ABIERTO;
      for (const next of t.path) {
        await tx.ticketHistory.create({
          data: {
            ticketId: ticket.id,
            previousStatus: previous,
            newStatus: next,
            changedById: assigneeId ?? null,
          },
        });
        previous = next;
      }
    });
    created++;
  }

  console.log(`Seed completado: ${users.length} usuarios verificados, ${created} tickets nuevos.`);
}

main()
  .catch((e) => {
    console.error('Error ejecutando el seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
