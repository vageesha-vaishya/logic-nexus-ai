import { describe, expect, it } from 'vitest';
import { UIM_SUBGRAPH_SCHEMA } from './uim-subgraph.graphql';

describe('uim subgraph contract snapshot', () => {
  it('matches published graphql schema contract', () => {
    expect(UIM_SUBGRAPH_SCHEMA).toMatchSnapshot();
  });
});
