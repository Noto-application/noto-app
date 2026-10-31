import {
  createProjectSchema,
  projectResponseSchema,
  projectSchema,
  projectsResponseSchema,
  updateProjectSchema,
} from '@noto/shared';

const project = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Project',
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
};

describe('Project: роль текущего пользователя в shared-контракте', () => {
  it.each(['owner', 'editor', 'viewer'])('сохраняет роль %s в Project', (role) => {
    const input = { ...project, currentUserRole: role };
    expect(projectSchema.parse(input)).toEqual(input);
  });

  it('отклоняет Project без обязательной роли', () => {
    expect(projectSchema.safeParse(project).success).toBe(false);
  });

  it.each([null, 'administrator', 123])('отклоняет недопустимую роль %p', (role) => {
    expect(projectSchema.safeParse({ ...project, currentUserRole: role }).success).toBe(false);
  });

  it('требует роль в обёртке одиночного Project для get/create/update', () => {
    expect(projectResponseSchema.safeParse({ project }).success).toBe(false);
  });

  it('требует роль у каждого элемента списка, сохраняя допустимость пустого списка', () => {
    expect(projectsResponseSchema.parse({ projects: [] })).toEqual({ projects: [] });
    expect(
      projectsResponseSchema.safeParse({
        projects: [{ ...project, currentUserRole: 'owner' }, project],
      }).success,
    ).toBe(false);
  });

  it.each([
    ['create', createProjectSchema],
    ['update', updateProjectSchema],
  ] as const)('%s игнорирует лишнюю входную роль без ошибки валидации', (_name, schema) => {
    expect(schema.parse({ name: ' Project ', currentUserRole: 'administrator' })).toEqual({
      name: 'Project',
    });
  });
});
