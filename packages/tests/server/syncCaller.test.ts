import { handleError, waitError } from './___testHelpers';
import { TRPCError, initTRPC } from '@trpc/server/src';
import { expectTypeOf } from 'expect-type';
import { z } from 'zod';

const t = initTRPC
  .context<{
    foo?: 'bar';
  }>()
  .create();

const { procedure } = t;

test('undefined input query', () => {
  const router = t.router({
    hello: procedure.query(() => 'world'),
  });

  const caller = router.createSyncCaller({});
  const result = caller.hello();
  expectTypeOf<string>(result);
});

test('input query', () => {
  const router = t.router({
    greeting: t.procedure
      .input(z.object({ name: z.string() }))
      .query(({ input }) => `Hello ${input.name}`),
  });

  const caller = router.createSyncCaller({});
  const result = caller.greeting({ name: 'Sachin' });

  expectTypeOf<string>(result);
});

test('input mutation', async () => {
  const posts = ['One', 'Two', 'Three'];

  const router = t.router({
    post: t.router({
      delete: t.procedure.input(z.number()).mutation(({ input }) => {
        posts.splice(input, 1);
      }),
    }),
  });

  const caller = router.createSyncCaller({});
  caller.post.delete(0);

  expect(posts).toStrictEqual(['Two', 'Three']);
});

test('input subscription', async () => {
  const onDelete = jest.fn();
  const router = t.router({
    onDelete: t.procedure.subscription(onDelete),
  });

  const caller = router.createSyncCaller({});
  caller.onDelete();

  expect(onDelete).toHaveBeenCalledTimes(1);
});

test('context with middleware', () => {
  const isAuthed = t.middleware(({ next, ctx }) => {
    if (!ctx.foo) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You are not authorized',
      });
    }

    return next();
  });

  const protectedProcedure = t.procedure.use(isAuthed);

  const router = t.router({
    secret: protectedProcedure.query(({ ctx }) => ctx.foo),
  });

  const caller = router.createSyncCaller({});
  const error = handleError(() => {
    caller.secret();
  }, TRPCError);
  expect(error.code).toBe('UNAUTHORIZED');
  expect(error.message).toBe('You are not authorized');

  const authorizedCaller = router.createSyncCaller({ foo: 'bar' });
  const result = authorizedCaller.secret();
  expect(result).toBe('bar');
});
