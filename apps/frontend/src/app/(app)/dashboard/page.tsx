'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProjectSchema, type CreateProjectDto } from '@grillz/shared-types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
} from '@grillz/ui';
import { useCreateProject, useProjects } from '@/features/api/hooks';
import { formatDate } from '@/lib/format';

const STATUS_VARIANT = {
  DRAFT: 'outline',
  SCANNING: 'warning',
  DESIGNING: 'default',
  REVIEW: 'warning',
  ORDERED: 'success',
  ARCHIVED: 'outline',
} as const;

export default function DashboardPage() {
  const { data, isLoading } = useProjects();
  const createProject = useCreateProject();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateProjectDto>({ resolver: zodResolver(createProjectSchema) });

  const onCreate = handleSubmit(async (values) => {
    await createProject.mutateAsync(values);
    reset();
    setOpen(false);
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each project holds a customer&apos;s scans and designs.
          </p>
        </div>
        <Button variant="gold" onClick={() => setOpen(true)}>
          New project
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {data.items.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link href={`/projects/${project.id}`}>
                <Card className="transition-colors hover:border-gold-500/30">
                  <CardHeader className="flex-row items-start justify-between space-y-0">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <Badge variant={STATUS_VARIANT[project.status] ?? 'outline'}>
                      {project.status.toLowerCase()}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-1 text-sm text-muted-foreground">
                      {project.description || 'No description'}
                    </p>
                    <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{project.scans.length} scans</span>
                      <span>{project._count?.grillz ?? 0} designs</span>
                      <span className="ml-auto">{formatDate(project.updatedAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="font-display text-xl">No projects yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a project, upload a dental scan and start designing.
          </p>
          <Button variant="gold" className="mt-6" onClick={() => setOpen(true)}>
            Create your first project
          </Button>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Project name</Label>
              <Input id="name" placeholder="e.g. Marcus — full lower set" {...register('name')} />
              {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" {...register('description')} />
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={createProject.isPending}>
              {createProject.isPending ? 'Creating…' : 'Create project'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
