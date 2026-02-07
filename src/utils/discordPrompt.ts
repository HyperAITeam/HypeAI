import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  EmbedBuilder,
  type TextChannel,
  type MessageComponentInteraction,
} from "discord.js";

const PROMPT_TIMEOUT = 60_000; // 60 seconds

interface AskQuestion {
  question: string;
  header?: string;
  options: { label: string; description?: string }[];
  multiSelect?: boolean;
}

interface AskInput {
  questions: AskQuestion[];
  answers?: Record<string, string>;
}

/**
 * Bridge between Claude's AskUserQuestion tool and Discord UI.
 *
 * Sends each question as either buttons (≤4 options) or a select menu (>4),
 * waits for user interaction, and returns the collected answers.
 */
export async function handleAskUserQuestion(
  input: AskInput,
  channel: TextChannel,
  userId: string,
): Promise<AskInput> {
  const answers: Record<string, string> = {};

  for (const q of input.questions) {
    const answer = await askSingleQuestion(q, channel, userId);
    answers[q.question] = answer;
  }

  return { questions: input.questions, answers };
}

async function askSingleQuestion(
  q: AskQuestion,
  channel: TextChannel,
  userId: string,
): Promise<string> {
  const embed = new EmbedBuilder()
    .setTitle(q.header ?? "Claude asks")
    .setDescription(q.question)
    .setColor(0xDA7756);

  // Add option descriptions to embed
  if (q.options.some((o) => o.description)) {
    const desc = q.options
      .map((o, i) => `**${i + 1}. ${o.label}** — ${o.description ?? ""}`)
      .join("\n");
    embed.addFields({ name: "Options", value: desc });
  }

  // Use buttons for ≤4 options, select menu otherwise
  if (q.options.length <= 4) {
    return askWithButtons(q, embed, channel, userId);
  }
  return askWithSelect(q, embed, channel, userId);
}

async function askWithButtons(
  q: AskQuestion,
  embed: EmbedBuilder,
  channel: TextChannel,
  userId: string,
): Promise<string> {
  const buttons = q.options.map((opt, i) =>
    new ButtonBuilder()
      .setCustomId(`askq_${i}`)
      .setLabel(opt.label.slice(0, 80))
      .setStyle(i === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

  const sent = await channel.send({ embeds: [embed], components: [row] });

  try {
    const interaction = await sent.awaitMessageComponent({
      filter: (i: MessageComponentInteraction) => {
        if (i.user.id !== userId) {
          i.reply({ content: "Only the requester can answer.", ephemeral: true });
          return false;
        }
        return true;
      },
      componentType: ComponentType.Button,
      time: PROMPT_TIMEOUT,
    });

    const idx = parseInt(interaction.customId.split("_")[1], 10);
    const selected = q.options[idx]?.label ?? q.options[0].label;

    // Update message to show the choice
    const disabledButtons = q.options.map((opt, i) =>
      new ButtonBuilder()
        .setCustomId(`askq_${i}`)
        .setLabel(opt.label.slice(0, 80))
        .setStyle(i === idx ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(true),
    );
    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButtons);

    await interaction.update({
      embeds: [embed.setFooter({ text: `Selected: ${selected}` })],
      components: [disabledRow],
    });

    return selected;
  } catch {
    // Timeout — auto-select first option
    const fallback = q.options[0].label;
    await sent.edit({
      embeds: [embed.setFooter({ text: `Auto-selected: ${fallback} (timeout)` })],
      components: [],
    });
    return fallback;
  }
}

async function askWithSelect(
  q: AskQuestion,
  embed: EmbedBuilder,
  channel: TextChannel,
  userId: string,
): Promise<string> {
  const select = new StringSelectMenuBuilder()
    .setCustomId("askq_select")
    .setPlaceholder("Select an option...")
    .setMinValues(1)
    .setMaxValues(q.multiSelect ? q.options.length : 1);

  for (const [i, opt] of q.options.entries()) {
    select.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(opt.label.slice(0, 100))
        .setValue(String(i))
        .setDescription(opt.description?.slice(0, 100) ?? ""),
    );
  }

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  const sent = await channel.send({ embeds: [embed], components: [row] });

  try {
    const interaction = await sent.awaitMessageComponent({
      filter: (i: MessageComponentInteraction) => {
        if (i.user.id !== userId) {
          i.reply({ content: "Only the requester can answer.", ephemeral: true });
          return false;
        }
        return true;
      },
      componentType: ComponentType.StringSelect,
      time: PROMPT_TIMEOUT,
    });

    const labels = interaction.values.map(
      (v: string) => q.options[parseInt(v, 10)]?.label ?? "",
    );
    const selected = labels.join(", ");

    await interaction.update({
      embeds: [embed.setFooter({ text: `Selected: ${selected}` })],
      components: [],
    });

    return selected;
  } catch {
    const fallback = q.options[0].label;
    await sent.edit({
      embeds: [embed.setFooter({ text: `Auto-selected: ${fallback} (timeout)` })],
      components: [],
    });
    return fallback;
  }
}
