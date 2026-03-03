import { type SurveyQuestion } from './types';

/**
 * Curated food-service question library.
 * Admin picks 5–8 of these per survey. IDs are stable — never change them.
 */
export const SURVEY_QUESTION_LIBRARY: SurveyQuestion[] = [
  { id: 'food_quality',  text: '¿Cómo calificarías la calidad de los alimentos?',           type: 'star',  required: true  },
  { id: 'menu_variety',  text: '¿Cómo calificarías la variedad del menú?',                  type: 'star',  required: true  },
  { id: 'portion_size',  text: '¿Qué tan satisfecho estás con el tamaño de las porciones?', type: 'emoji', required: true  },
  { id: 'service_speed', text: '¿Cómo calificarías la velocidad del servicio?',              type: 'emoji', required: true  },
  { id: 'presentation',  text: '¿Cómo calificarías la presentación de los platillos?',      type: 'star',  required: true  },
  { id: 'cleanliness',   text: '¿Qué tan satisfecho estás con la limpieza del comedor?',    type: 'emoji', required: true  },
  { id: 'recommend',     text: '¿Recomendarías este servicio de comedor a un colega?',       type: 'star',  required: true  },
  { id: 'open_text',     text: '¿Tienes algún comentario adicional?',                        type: 'text',  required: false },
];
