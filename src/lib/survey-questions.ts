import { type SurveyQuestion } from './types';

/**
 * Curated food-service question library.
 * Admin picks 5–8 of these per survey. IDs are stable — never change them.
 */
export const SURVEY_QUESTION_LIBRARY: SurveyQuestion[] = [
  // ── Original questions ──
  { id: 'food_quality',  text: '¿Cómo calificarías la calidad de los alimentos?',           type: 'star',  required: true  },
  { id: 'menu_variety',  text: '¿Cómo calificarías la variedad del menú?',                  type: 'star',  required: true  },
  { id: 'portion_size',  text: '¿Qué tan satisfecho estás con el tamaño de las porciones?', type: 'emoji', required: true  },
  { id: 'service_speed', text: '¿Cómo calificarías la velocidad del servicio?',              type: 'emoji', required: true  },
  { id: 'presentation',  text: '¿Cómo calificarías la presentación de los platillos?',      type: 'star',  required: true  },
  { id: 'cleanliness',   text: '¿Qué tan satisfecho estás con la limpieza del comedor?',    type: 'emoji', required: true  },
  { id: 'recommend',     text: '¿Recomendarías este servicio de comedor a un colega?',       type: 'star',  required: true  },
  { id: 'open_text',     text: '¿Tienes algún comentario adicional?',                        type: 'text',  required: false },

  // ── Comedor ejecutivo questions ──
  {
    id: 'uso_actual',
    text: '¿Ya has utilizado el comedor ejecutivo?',
    type: 'multiple_choice',
    required: true,
    options: ['Sí', 'No, pero planeo hacerlo', 'No y no tengo interés'],
  },
  {
    id: 'frecuencia_esperada',
    text: '¿Cuántas veces a la semana considerarías usarlo?',
    type: 'multiple_choice',
    required: true,
    options: ['1 vez', '2–3 veces', '4–5 veces', 'Solo ocasionalmente', 'No lo usaría'],
  },
  {
    id: 'percepcion_precio',
    text: 'El precio de $350 por comida de 4 tiempos te parece:',
    type: 'multiple_choice',
    required: true,
    options: ['Muy caro', 'Algo caro', 'Justo', 'Buen valor por lo que ofrece', 'Excelente relación calidad-precio'],
  },
  {
    id: 'precio_ideal',
    text: '¿Cuál considerarías un precio ideal?',
    type: 'multiple_choice',
    required: true,
    options: ['$200', '$250', '$300', '$350'],
  },
  {
    id: 'calidad_sabor',
    text: 'Evalúa el sabor de los alimentos',
    type: 'star',
    required: true,
  },
  {
    id: 'calidad_presentacion',
    text: 'Evalúa la presentación',
    type: 'star',
    required: true,
  },
  {
    id: 'calidad_variedad',
    text: 'Evalúa la variedad del menú',
    type: 'star',
    required: true,
  },
  {
    id: 'calidad_porciones',
    text: 'Evalúa el tamaño de porciones',
    type: 'star',
    required: true,
  },
  {
    id: 'calidad_servicio',
    text: 'Evalúa el servicio / atención',
    type: 'star',
    required: true,
  },
  {
    id: 'calidad_tiempo',
    text: 'Evalúa el tiempo de servicio',
    type: 'star',
    required: true,
  },
  {
    id: 'calidad_ambiente',
    text: 'Evalúa el ambiente / espacio',
    type: 'star',
    required: true,
  },
  {
    id: 'valor_percibido',
    text: '¿Qué tan alineado está el comedor con lo que esperas de un "comedor ejecutivo"?',
    type: 'multiple_choice',
    required: true,
    options: ['Nada alineado', 'Poco alineado', 'Neutral', 'Bien alineado', 'Totalmente alineado'],
  },
  {
    id: 'drivers_decision',
    text: '¿Qué es lo MÁS importante para que lo uses frecuentemente? (elige máximo 3)',
    type: 'multi_select',
    required: true,
    maxSelections: 3,
    options: ['Calidad del sabor', 'Precio', 'Rapidez', 'Opciones saludables', 'Tamaño de porción', 'Variedad', 'Ambiente / comodidad', 'Cercanía / conveniencia'],
  },
  {
    id: 'barreras',
    text: 'Si no lo usarías o lo usarías poco, ¿por qué?',
    type: 'multiple_choice',
    required: false,
    options: ['Precio alto', 'Prefiero traer comida', 'Opciones no atractivas', 'Tiempo limitado', 'Porciones insuficientes', 'No es prioridad'],
  },
  {
    id: 'nps_comedor',
    text: '¿Qué tan probable es que recomiendes el comedor a un colega?',
    type: 'nps',
    required: true,
  },
  {
    id: 'feedback_mejoras',
    text: '¿Qué mejorarías del comedor ejecutivo?',
    type: 'text',
    required: false,
  },
  {
    id: 'feedback_deseos',
    text: '¿Qué te encantaría ver que hoy no existe?',
    type: 'text',
    required: false,
  },
];
