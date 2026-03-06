import { render, screen, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

type Values = {
  name: string;
};

function TestForm() {
  const form = useForm<Values>({
    defaultValues: { name: '' },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  return (
    <Form {...form}>
      <form>
        <FormField
          control={form.control}
          name={'name'}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input data-testid="name-input" placeholder="Name" {...field} />
              </FormControl>
              <FormMessage />
              <button
                type="button"
                data-testid="set-error"
                onClick={() => form.setError('name', { type: 'manual', message: 'Name is required' })}
              />
              <button type="button" data-testid="clear-error" onClick={() => form.clearErrors('name')} />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

describe('Form error highlighting', () => {
  it('shows error icon/message and marks field container invalid', async () => {
    render(<TestForm />);

    await act(async () => {
      screen.getByTestId('set-error').click();
    });

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByTestId('field-error-icon')).toBeInTheDocument();

    const container = screen.getByTestId('name-input').closest('[data-field-name="name"]');
    expect(container).not.toBeNull();
    expect(container?.getAttribute('data-invalid')).toBe('true');
  });

  it('removes invalid marker when error clears', async () => {
    render(<TestForm />);

    await act(async () => {
      screen.getByTestId('set-error').click();
    });

    const containerBefore = screen.getByTestId('name-input').closest('[data-field-name="name"]');
    expect(containerBefore?.getAttribute('data-invalid')).toBe('true');

    await act(async () => {
      screen.getByTestId('clear-error').click();
    });

    const containerAfter = screen.getByTestId('name-input').closest('[data-field-name="name"]');
    expect(containerAfter?.getAttribute('data-invalid')).toBe('false');
  });
});
