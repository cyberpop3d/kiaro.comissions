import type { ServiceTopic } from '@/lib/types';

export const serviceTopics: Array<{
  value: ServiceTopic;
  label: string;
  description: string;
}> = [
  {
    value: '3d-product-development',
    label: '3D Printing, Manufacturing & Product Design',
    description: '3D printing, mass production, print-farm workflows, visualization and product development.'
  },
  {
    value: 'ui-ux',
    label: 'UI/UX Design',
    description: 'Digital product interfaces, user flows and experience design.'
  },
  {
    value: 'interior-design',
    label: 'Interior Design',
    description: 'Spatial concepts, visualization and interior product integration.'
  },
  {
    value: 'website-interaction',
    label: 'Website & Interaction Design',
    description: 'Web experiences, interaction systems and conversion-focused interfaces.'
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Early-stage ideas, feasibility questions and requests outside these categories.'
  }
];

export function isServiceTopic(value: string | null | undefined): value is ServiceTopic {
  return serviceTopics.some((topic) => topic.value === value);
}

export function getServiceTopicLabel(value: ServiceTopic | null | undefined) {
  return serviceTopics.find((topic) => topic.value === value)?.label || 'General design request';
}
