import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import grapesjs, { type Editor } from "grapesjs";
import mjml2html from "mjml-browser";
import { Input } from "@shared/components/ui/input.tsx";
import mjmlPlugin from "grapesjs-mjml";
import "grapesjs/dist/css/grapes.min.css";
import "./styles/grapesjs-custom.css";
import { toast } from "sonner";
import type { AxiosError } from "axios";

import {
  createTemplate,
  getTemplateDetails,
  updateTemplateDetails,
  type Template,
} from "../../api/templates.api";
import { Field, FieldError } from "@/shared/components/ui/field";
import { InputGroup, InputGroupAddon } from "@/shared/components/ui/input-group";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { SquarePenIcon, DownloadIcon, Save, Info, X } from "lucide-react";
import { Combobox } from "@shared/components/ui/combobox";
import { Button, buttonVariants } from "@shared/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@shared/components/ui/alert-dialog";

function InfoBanner({children}: {children: React.ReactNode}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="pointer-events-auto rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 my-3 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-sky-600"><Info size={18} /></span>
        {children}
        <button
          onClick={() => setOpen(false)}
          aria-label="Dismiss information"
          className="mt-0.5 rounded-md p-1 text-slate-400 hover:bg-sky-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

type GjsComponent = any;

const INITIAL_MJML_TEMPLATE = `
  <mjml>
    <mj-body background-color="#f2f2f2">
      <mj-section full-width="full-width" padding="0">
        <mj-column width="100%">
          <mj-text align="center" font-size="14px" color="#94a3b8" font-style="italic" padding="12px">
            Start creating template by drag and drop here
          </mj-text>
        </mj-column>
      </mj-section>
    </mj-body>
  </mjml>
`.trim();

const BLOCKS_PANEL_ID = "builder-blocks-panel";
const PROPS_PANEL_ID = "builder-props-panel";
const TRAITS_PANEL_ID = "builder-traits-panel";
type Device = "Desktop" | "Mobile";

/**
 * ✅ IMPORTANT:
 * MJML DOES NOT allow arbitrary attributes like data-*
 * So we use css-class markers (valid in MJML) and control GrapesJS behaviors via component properties.
 */
const CLS = {
  // Each
  eachOpen: "each-open",
  eachClose: "each-close",
  eachSection: "each-section",
  eachWrapper: "each-wrapper",
  eachPlaceholder: "each-placeholder",

  // If
  ifOpen: "if-open",
  ifClose: "if-close",
  ifSection: "if-section",
  elseSection: "else-section",
  ifWrapper: "if-wrapper",
  ifPlaceholder: "if-placeholder",

  // Unless
  unlessOpen: "unless-open",
  unlessClose: "unless-close",
  unlessSection: "unless-section",
  unlessWrapper: "unless-wrapper",
  unlessPlaceholder: "unless-placeholder",

  // Boolean
  booleanWrapper: "boolean-wrapper",
  booleanPlaceholder: "boolean-placeholder",
  initialSample: "initial-sample",
};

const DEFAULT_EACH_ITEMS = "items";
const DEFAULT_IF_CONDITION = "condition";
const DEFAULT_UNLESS_CONDITION = "condition";
const TIMELINE_MARKER_CLASS = "timeline-variant";
/**
 * If you previously saved MJML with data-* attributes,
 * sanitize before compiling / saving so mjml2html won't throw "illegal attribute".
 */
const sanitizeMjml = (mjml: string) => {
  if (!mjml) return mjml;
  // Remove any data-* attributes (including old data-if-wrapper / data-gjs-* etc)
  return mjml.replace(
    /\sdata-[a-zA-Z0-9_-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g,
    "",
  );
};

const normalizeRaw = (s: string) =>
  String(s || "")
    .replace(/\\"/g, '"')     // handles \" in stored strings
    .replace(/&quot;/g, '"'); // handles html-escaped quotes

const parseTimelineVariantFromRaw = (rawHtml: string): string | "" => {
  const s = normalizeRaw(rawHtml);

  // order-delivered: all connectors pink, Delivered label pink
  if (s.includes('color:#9b0034;">Delivered</div>')) return "order-delivered";

  // order-processed: shipped circle active + connector split 50/50
  if (
    s.includes('color:#9b0034;">Shipped</div>') &&
    s.includes('left:0;width:50%;top:14px;height:2px;background:#9b0034;') &&
    s.includes('left:50%;right:0;top:14px;height:2px;background:#d7d7d7;')
  ) return "order-processed";

  // finalize-delivery-date: shipped connector 20% pink then gray
  if (
    s.includes('left:0;width:20%;top:14px;height:2px;background:#9b0034;') &&
    s.includes('left:20%;right:0;top:14px;height:2px;background:#d7d7d7;')
  ) return "finalize-delivery-date";

  // calendar-rescheduled-confirmation: ordered connector half pink half gray using calc + 50%
  if (
    s.includes('left:calc(50% + 14px);width:50%;top:14px;height:2px;background:#9b0034;') &&
    s.includes('left:calc(50% + 14px + 50%);right:0;top:14px;height:2px;background:#d7d7d7;')
  ) return "calendar-rescheduled-confirmation";

  // order-confirmation: default timeline (only Ordered is active, rest gray)
  if (
    s.includes('color:#9b0034;">Ordered</div>') &&
    s.includes("background:#cfcfcf") &&
    s.includes(">Shipped</div>") &&
    s.includes(">Delivered</div>")
  ) return "order-confirmation";

  return "";
};


const hydrateTimelineTraits = (editor: Editor) => {
  const root = editor.DomComponents.getWrapper();
  if (!root) return;

  // find all mj-text that are timeline blocks (either have css-class marker OR contain mj-raw timeline html)
  const allTexts = root.find?.('[data-gjs-type="mj-text"]') || [];

  allTexts.forEach((txt: any) => {
    const attrs = txt.getAttributes?.() || {};
    const cls = String(attrs["css-class"] || "");
    const isTimeline = cls.split(/\s+/).includes(TIMELINE_MARKER_CLASS);

    // Also support older saved templates that don't have marker
    // Detect if it contains mj-raw with timeline div structure
    let rawChild: any = null;
    txt.components?.().forEach?.((c: any) => {
      if (c?.get?.("type") === "mj-raw") rawChild = c;
    });

    const rawText = rawChild ? getRawText(rawChild) : "";
    const looksLikeTimeline = rawText.includes("display:flex;align-items:flex-start;") && rawText.includes(">Ordered</div>");

    if (!isTimeline && !looksLikeTimeline) return;

    // If it's missing, keep the marker so future loads are easy
    if (!isTimeline) {
      txt.addAttributes?.({ "css-class": `${cls} ${TIMELINE_MARKER_CLASS}`.trim() });
    }

    // If already has data-variant, nothing to do
    const currentVariant = attrs["data-variant"];
    if (currentVariant) return;

    const detected = parseTimelineVariantFromRaw(rawText);
    if (detected) {
      // Set attribute so enableMjTextVariants trait becomes meaningful
      txt.addAttributes?.({ "data-variant": detected });
    } else {
      // fallback
      txt.addAttributes?.({ "data-variant": "order-confirmation" });
    }
  });
};


const getCssClassList = (cmp: any) =>
  String(cmp?.getAttributes?.()?.["css-class"] || "")
    .split(/\s+/)
    .filter(Boolean);

const hasCssClass = (cmp: any, cls: string) => getCssClassList(cmp).includes(cls);

const getRawText = (rawCmp: any) => {
  // grapesjs-mjml usually stores mj-raw content in `content`
  const c = rawCmp?.get?.("content");
  if (typeof c === "string" && c.trim()) return c.trim();

  // fallback: sometimes content ends up as inner components text
  const html = rawCmp?.toHTML?.();
  if (typeof html === "string" && html.trim()) {
    // remove wrapping tags if any (very defensive)
    return html.replace(/<\/?mj-raw[^>]*>/g, "").trim();
  }
  return "";
};

const findSiblingOpenRaw = (wrapperCol: any, openCls: string) => {
  // wrapperCol is mj-column (if-wrapper/unless-wrapper/each-wrapper)
  // it sits inside mj-section. open raw is usually a sibling of that section.
  let section = wrapperCol?.parent?.();
  while (section && section.get?.("type") !== "mj-section") section = section.parent?.();

  const parent = section?.parent?.();
  const siblings = parent?.components?.();
  if (!section || !parent || !siblings) return null;

  const idx = siblings.indexOf?.(section);
  if (typeof idx !== "number" || idx < 0) return null;

  const prev = siblings.at?.(idx - 1);
  if (prev?.get?.("type") === "mj-raw" && hasCssClass(prev, openCls)) return prev;

  // some templates can have whitespace raw nodes; scan backwards a bit
  for (let i = idx - 1; i >= 0 && i >= idx - 6; i--) {
    const s = siblings.at?.(i);
    if (s?.get?.("type") === "mj-raw" && hasCssClass(s, openCls)) return s;
  }

  return null;
};

const parseHandlebars = {
  ifOpen: (txt: string) => {
    // matches: {{#if something}} or {{#if something}}
    const m = txt.match(/{{\s*#if\s+([^}]+?)\s*}}?/);
    return m?.[1]?.trim() || "";
  },
  unlessOpen: (txt: string) => {
    const m = txt.match(/{{\s*#unless\s+([^}]+?)\s*}}?/);
    return m?.[1]?.trim() || "";
  },
  eachOpen: (txt: string) => {
    const m = txt.match(/{{\s*#each\s+([^}]+?)\s*}}?/);
    return m?.[1]?.trim() || "";
  },
};

const hydrateDynamicTraits = (editor: Editor) => {
  const root = editor.DomComponents.getWrapper();
  if (!root) return;

  // ---------- IF wrappers ----------
  const ifWrappers = root.find?.(`.${CLS.ifWrapper}`) || [];
  ifWrappers.forEach((w: any) => {
    const openRaw = findSiblingOpenRaw(w, CLS.ifOpen);
    const condFromRaw = openRaw ? parseHandlebars.ifOpen(getRawText(openRaw)) : "";

    // set prop so your attachIfConditionEditor trait logic can show it
    if (condFromRaw) w.set?.("ifCondition", condFromRaw);
    else if (!w.get?.("ifCondition")) w.set?.("ifCondition", DEFAULT_IF_CONDITION);

    // ensure trait exists (same shape as your ensureTrait)
    const hasTrait = (w.getTraits?.() || []).some((t: any) => t.get?.("name") === "ifCondition");
    if (!hasTrait) {
      w.addTrait?.({
        type: "text",
        name: "ifCondition",
        label: "Condition",
        placeholder: "Condition",
        changeProp: 1,
      });
    }
  });

  // ---------- UNLESS wrappers ----------
  const unlessWrappers = root.find?.(`.${CLS.unlessWrapper}`) || [];
  unlessWrappers.forEach((w: any) => {
    const openRaw = findSiblingOpenRaw(w, CLS.unlessOpen);
    const condFromRaw = openRaw ? parseHandlebars.unlessOpen(getRawText(openRaw)) : "";

    if (condFromRaw) w.set?.("unlessCondition", condFromRaw);
    else if (!w.get?.("unlessCondition")) w.set?.("unlessCondition", DEFAULT_UNLESS_CONDITION);

    const hasTrait = (w.getTraits?.() || []).some((t: any) => t.get?.("name") === "unlessCondition");
    if (!hasTrait) {
      w.addTrait?.({
        type: "text",
        name: "unlessCondition",
        label: "Condition",
        placeholder: "Condition",
        changeProp: 1,
      });
    }
  });

  // ---------- EACH wrappers ----------
  const eachWrappers = root.find?.(`.${CLS.eachWrapper}`) || [];
  eachWrappers.forEach((w: any) => {
    const openRaw = findSiblingOpenRaw(w, CLS.eachOpen);
    const itemsFromRaw = openRaw ? parseHandlebars.eachOpen(getRawText(openRaw)) : "";

    if (itemsFromRaw) w.set?.("eachItems", itemsFromRaw);
    else if (!w.get?.("eachItems")) w.set?.("eachItems", DEFAULT_EACH_ITEMS);

    const hasTrait = (w.getTraits?.() || []).some((t: any) => t.get?.("name") === "eachItems");
    if (!hasTrait) {
      w.addTrait?.({
        type: "text",
        name: "eachItems",
        label: "Items key",
        placeholder: "e.g. items, products, order.items",
        changeProp: 1,
      });
    }
  });

  // Also re-apply wrapper droppable (optional, but helps after reload)
  [...ifWrappers, ...unlessWrappers, ...eachWrappers].forEach((w: any) => setWrapperDroppable(w));
};


const registerCustomBlocks = (editor: Editor) => {
  const blockManager = editor.BlockManager;

  const ensureCategoryOpen = (id: string) => {
    const categories = blockManager.getCategories();
    categories.each((cat: any) => {
      if (!cat) return;
      const catId = cat.get("id") || cat.get("label");
      if (catId === id || id === "*") cat.set("open", true);
    });
  };

  const isWrapperColumn = (component: GjsComponent) => {
    if (!component) return false;
    const cls = String(component?.getAttributes?.()?.["css-class"] || "");
    return [CLS.ifWrapper, CLS.unlessWrapper, CLS.eachWrapper, CLS.booleanWrapper].some(
      (wc) => cls.split(/\s+/).includes(wc),
    );
  };

  const isColumnOrWrapper = (c: GjsComponent | null) =>
    c && (c.get?.("type") === "mj-column" || isWrapperColumn(c));

  const blockManagerAny = blockManager as any;

  if (blockManagerAny.getContainer) {
    const originalGetContainer = blockManagerAny.getContainer.bind(blockManager);
    blockManagerAny.getContainer = function (block: any, opts: any = {}) {
      const selected = editor.getSelected();
      if (isColumnOrWrapper(selected)) {
        setWrapperDroppable(selected);
        selected!.set?.("droppable", true);
        return selected;
      }
      return originalGetContainer(block, opts);
    };
  }

  if (blockManagerAny.append) {
    const originalAppend = blockManagerAny.append.bind(blockManager);
    blockManagerAny.append = function (block: any, opts: any = {}) {
      const selected = editor.getSelected();
      if (isColumnOrWrapper(selected)) {
        setWrapperDroppable(selected);
        selected!.set?.("droppable", true);
      }
      return originalAppend(block, opts);
    };
  }

  editor.on("block:add", (_block: any, _target: any) => {
    const selected = editor.getSelected();
    if (isColumnOrWrapper(selected)) {
      setWrapperDroppable(selected);
      selected!.set?.("droppable", true);
    }
  });

  /** EACH block (no data-* attrs, use css-class markers only) **/
  const each = `
<mj-raw css-class="${CLS.eachOpen}">{{#each ${DEFAULT_EACH_ITEMS}}}</mj-raw>

<mj-section padding="12px 0" css-class="${CLS.eachSection}" background-color="#ffffff">
  <mj-column padding="12px 0" css-class="${CLS.eachWrapper}">
    <mj-text
      align="center"
      font-size="14px"
      color="#94a3b8"
      font-style="italic"
      padding="12px"
      line-height="1.4"
      css-class="${CLS.eachPlaceholder}"
    >
      Drop loop content here (EACH)
    </mj-text>
  </mj-column>
</mj-section>

<mj-raw css-class="${CLS.eachClose}">{{/each}}</mj-raw>
`.trim();

  /** IF/ELSE block (no data-* attrs) **/
  const conditionalBlock = `
<mj-raw css-class="${CLS.ifOpen}">{{#if ${DEFAULT_IF_CONDITION}}}</mj-raw>

<mj-section padding="12px 0" css-class="${CLS.ifSection}" background-color="#ffffff">
  <mj-column padding="12px 0" css-class="${CLS.ifWrapper}">
    <mj-text
      align="center"
      font-size="14px"
      color="#94a3b8"
      font-style="italic"
      padding="12px"
      line-height="1.4"
      css-class="${CLS.ifPlaceholder}"
    >
      Drop conditional content here (IF)
    </mj-text>
  </mj-column>
</mj-section>

<mj-raw>{{else}}</mj-raw>

<mj-section padding="12px 0" css-class="${CLS.elseSection}" background-color="#ffffff">
  <mj-column padding="12px 0" css-class="${CLS.ifWrapper}">
    <mj-text
      align="center"
      font-size="14px"
      color="#94a3b8"
      font-style="italic"
      padding="12px"
      line-height="1.4"
      css-class="${CLS.ifPlaceholder}"
    >
      Drop conditional content here (ELSE)
    </mj-text>
  </mj-column>
</mj-section>

<mj-raw css-class="${CLS.ifClose}">{{/if}}</mj-raw>
`.trim();

  /** UNLESS block (no data-* attrs) **/
  const unlessBlock = `
<mj-raw css-class="${CLS.unlessOpen}">{{#unless ${DEFAULT_UNLESS_CONDITION}}}</mj-raw>

<mj-section padding="12px 0" css-class="${CLS.unlessSection}" background-color="#ffffff">
  <mj-column padding="12px 0" css-class="${CLS.unlessWrapper}">
    <mj-text
      align="center"
      font-size="14px"
      color="#94a3b8"
      font-style="italic"
      padding="12px"
      line-height="1.4"
      css-class="${CLS.unlessPlaceholder}"
    >
      Drop conditional content here (UNLESS)
    </mj-text>
  </mj-column>
</mj-section>

<mj-raw css-class="${CLS.unlessClose}">{{/unless}}</mj-raw>
`.trim();

  /** Boolean badge (no data-* attrs) **/
  const booleanBadge = `
<mj-section padding="12px 0" background-color="#ffffff">
  <mj-column padding="12px 0" css-class="${CLS.booleanWrapper}">
    <mj-text align="center" font-size="14px" color="#f97316" font-weight="600" css-class="${CLS.initialSample}">
      Featured product? {{featuredProduct}}
    </mj-text>
    <mj-text
      align="center"
      font-size="14px"
      color="#94a3b8"
      font-style="italic"
      padding="12px"
      line-height="1.4"
      css-class="${CLS.booleanPlaceholder}"
    >
      Drop additional boolean content here (placeholder)
    </mj-text>
  </mj-column>
</mj-section>
`.trim();

  blockManager.add("timeline", {
    label: "Timeline",
    category: { id: "custom", label: "Custom Blocks" },
    attributes: { class: "fa fa-clone" },
    content: `
      <mj-section padding="0">
        <mj-column>
          <mj-text
            css-class="timeline-variant"
            font-size="24px"
            font-weight="700"
            align="center"
            padding="16px"
          >
            Select the variant from panel
          </mj-text>
        </mj-column>
      </mj-section>
    `,
  });

  // blockManager.add("product-card", {
  //   label: "Product Card",
  //   category: { id: "custom", label: "Custom Blocks" },
  //   content: productCard,
  //   media:
  //     '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m0 2v14h14V5H5m2 2h10v5H7V7m0 7h4v3H7v-3m6 0h4v3h-4v-3Z" /></svg>',
  // });

  blockManager.add("conditional-content", {
    label: "Conditional (If)",
    category: { id: "dynamic", label: "Dynamic Logic" },
    content: conditionalBlock,
    media:
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 7h2v3h2V7h2v10h-2v-5h-2v5H9V7M5 7h2v10H5V7m12 0h2v10h-2V7Z" /></svg>',
  });

  blockManager.add("unless-content", {
    label: "Conditional (Unless)",
    category: { id: "dynamic", label: "Dynamic Logic" },
    content: unlessBlock,
    media:
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 7h2v3h2V7h2v10h-2v-5h-2v5H9V7M5 7h2v10H5V7m12 0h2v10h-2V7Z" /></svg>',
  });

  blockManager.add("each-content", {
    label: "Each",
    category: { id: "dynamic", label: "Dynamic Logic" },
    content: each,
    media:
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 7h2v3h2V7h2v10h-2v-5h-2v5H9V7M5 7h2v10H5V7m12 0h2v10h-2V7Z" /></svg>',
  });

  blockManager.add("boolean-pill", {
    label: "Boolean Badge",
    category: { id: "dynamic", label: "Dynamic Logic" },
    content: booleanBadge,
    media:
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V5c0-1.1-.9-2-2-2m-9 5h2v8h-2V8m4 0h2v8h-2V8m-8 0h2v8H6V8Z" /></svg>',
  });

  ensureCategoryOpen("*");
};

const registerHandlebarsImageTrait = (editor: Editor) => {
  editor.TraitManager.addType("handlebars-image", {
    createInput({ component }) {
      const el = document.createElement("input");
      el.type = "text";
      el.placeholder = "e.g. image_url";
      el.className = "gjs-field";

      //  Read existing src and normalize for UI
      const src = component.getAttributes?.().src;
      if (src && src.startsWith("{{") && src.endsWith("}}")) {
        el.value = src.slice(2, -2); // show: image_url
      }

      return el;
    },

    onUpdate({ elInput, component }) {
      const raw = elInput.value?.trim();
      if (!raw) return;

      //  ALWAYS force this format
      const finalVal = `{{${raw.replace(/[{}]/g, "")}}}`;

      //  WRITE ONLY TO src
      component.addAttributes({
        src: finalVal,
      });

      // REMOVE any junk attributes GrapesJS might add
      component.removeAttributes(["imageVar", "imagevar", "__imageVar"]);
    },
  });

  const domc = editor.DomComponents;
  const imageType = domc.getType("mj-image");
  if (!imageType) return;

  domc.addType("mj-image", {
    model: {
      defaults: {
        ...imageType.model.prototype.defaults,
        traits: [
          {
            type: "handlebars-image",
            name: "src", //  bind only to src
            label: "Image Variable",
            changeProp: 1,
          },
          "alt",
          "href",
        ],
      },
    },
  });

  //  When image is added, remove any static src
  editor.on("component:add", (cmp) => {
    if (cmp.get?.("type") === "mj-image") {
      const attrs = cmp.getAttributes?.() || {};
      if (attrs.src && !String(attrs.src).startsWith("{{")) {
        cmp.removeAttributes(["src"]);
      }
    }
  });
};


// Shared helper to set wrapper column as droppable with function
const setWrapperDroppable = (wrapper: any) => {
  if (!wrapper) return;
  // Set droppable as a function that always returns true for MJML components and blocks
  wrapper.set?.({
    droppable: (draggedComponent: GjsComponent) => {
      // Always allow drops into wrapper columns (for blocks and components)
      if (!draggedComponent) return true;

      const draggedType = draggedComponent?.get?.("type");
      // Allow all MJML components
      if (draggedType?.startsWith("mj-")) return true;
      // Allow sections (for conditional blocks)
      if (draggedType === "mj-section") return true;
      // Allow any component type (for blocks from block manager)
      return true;
    },
  });
};

function enableMjTextVariants(editor: any) {
  const domc = editor.DomComponents;
  const mjTextType = domc.getType("mj-text");
  if (!mjTextType?.model) return;

  const originalInit = mjTextType.model.prototype.init;

  mjTextType.model.prototype.init = function (...args: any[]) {
    originalInit?.apply(this, args);

    const attrs = this.getAttributes?.() || {};
    const css = String(attrs["css-class"] || "");
    const isTimeline = css.split(/\s+/).includes("timeline-variant");

    const traits = (this.get("traits") || []).slice();
    const already = traits.some((t: any) => t?.name === "data-variant");

    if (isTimeline && !already) {
      this.set("traits", [
        {
          type: "select",
          name: "data-variant",
          label: "Variant",
          options: [
            { id: "", name: "Select Variant" },
            { id: "order-confirmation", name: "Order Confirmation" },
            { id: "calendar-rescheduled-confirmation", name: "Calendar/Rescheduled Confirmation" },
            { id: "finalize-delivery-date", name: "Finalize/Delivery Schedule Confirmed" },
            { id: "order-processed", name: "Order Processed" },
            { id: "order-delivered", name: "Order Delivered" },
          ],
        },
        ...traits,
      ]);
    }

    const applyVariant = () => {
      const a = this.getAttributes?.() || {};
      const v = a["data-variant"];
      if (!v) return;

      if (v === "order-confirmation") {
        this.addAttributes({
          "data-variant": "order-confirmation",
          "font-size": "24px",
          "font-weight": "700",
          align: "center",
          padding: "16px",
        });
        this.components(`<mj-raw>
        <div style="padding:12px 16px;background:#ffffff;">
          <div style="display:flex;align-items:flex-start;">
            <div style="flex:1;text-align:center;position:relative;">
              <div style="position:absolute;left:calc(50% + 14px);right:0;top:14px;height:2px;background:#d7d7d7;"></div>
              <span style="width:28px;height:28px;border-radius:50%;background:#9b0034;display:inline-flex;align-items:center;justify-content:center;margin:0 auto 8px;position:relative;z-index:1;">
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <path d="M6.3 11.3 3.4 8.4l-1 1 3.9 3.9L13.6 6l-1-1-6.3 6.3z" fill="#ffffff"/>
                </svg>
              </span>
              <div style="font-family:Arial;font-size:14px;font-weight:700;color:#9b0034;">Ordered</div>
              <div style="font-family:Arial;font-size:12px;color:#555555;margin-top:4px;white-space:nowrap;">Wed, Sep 14</div>
            </div>

            <div style="flex:1;text-align:center;position:relative;">
              <div style="position:absolute;left:0;right:0;top:14px;height:2px;background:#d7d7d7;"></div>
              <div style="position:absolute;left:calc(50% - 14px);width:28px;top:14px;height:2px;background:#ffffff;"></div>
              <span style="width:28px;height:28px;border-radius:50%;background:#cfcfcf;display:inline-block;margin:0 auto 8px;position:relative;z-index:1;"></span>
              <div style="font-family:Arial;font-size:14px;font-weight:600;color:#8a8a8a;">Shipped</div>
            </div>

            <div style="flex:1;text-align:center;position:relative;">
              <div style="position:absolute;left:0;right:calc(50% + 14px);top:14px;height:2px;background:#d7d7d7;"></div>
              <span style="width:28px;height:28px;border-radius:50%;background:#cfcfcf;display:inline-block;margin:0 auto 8px;position:relative;z-index:1;"></span>
              <div style="font-family:Arial;font-size:14px;font-weight:600;color:#8a8a8a;">Delivered</div>
            </div>
          </div>
        </div>
        </mj-raw>`.trim());
      }

      if (v === "calendar-rescheduled-confirmation") {
        this.addAttributes({
          "data-variant": "calendar-rescheduled-confirmation",
          "font-size": "16px",
          "font-weight": "400",
          align: "center",
          padding: "8px",
        });
        this.components(`<mj-raw>
        <div style="padding:12px 16px;background:#ffffff;">
          <div style="display:flex;align-items:flex-start;">
            <div style="flex:1;text-align:center;position:relative;">
              <!-- first half (completed) -->
              <div style="position:absolute;left:calc(50% + 14px);width:50%;top:14px;height:2px;background:#9b0034;"></div>

              <!-- second half (remaining) -->
              <div style="position:absolute;left:calc(50% + 14px + 50%);right:0;top:14px;height:2px;background:#d7d7d7;"></div>

              <span style="width:28px;height:28px;border-radius:50%;background:#9b0034;display:inline-flex;align-items:center;justify-content:center;margin:0 auto 8px;position:relative;z-index:1;">
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <path d="M6.3 11.3 3.4 8.4l-1 1 3.9 3.9L13.6 6l-1-1-6.3 6.3z" fill="#ffffff"/>
                </svg>
              </span>
              <div style="font-family:Arial;font-size:14px;font-weight:700;color:#9b0034;">Ordered</div>
              <div style="font-family:Arial;font-size:12px;color:#555555;margin-top:4px;white-space:nowrap;">Wed, Sep 14</div>
            </div>

            <div style="flex:1;text-align:center;position:relative;">
              <div style="position:absolute;left:0;right:0;top:14px;height:2px;background:#d7d7d7;"></div>
              <div style="position:absolute;left:calc(50% - 14px);width:28px;top:14px;height:2px;background:#ffffff;"></div>
              <span style="width:28px;height:28px;border-radius:50%;background:#cfcfcf;display:inline-block;margin:0 auto 8px;position:relative;z-index:1;"></span>
              <div style="font-family:Arial;font-size:14px;font-weight:600;color:#8a8a8a;">Shipped</div>
            </div>

            <div style="flex:1;text-align:center;position:relative;">
              <div style="position:absolute;left:0;right:calc(50% + 14px);top:14px;height:2px;background:#d7d7d7;"></div>
              <span style="width:28px;height:28px;border-radius:50%;background:#cfcfcf;display:inline-block;margin:0 auto 8px;position:relative;z-index:1;"></span>
              <div style="font-family:Arial;font-size:14px;font-weight:600;color:#8a8a8a;">Delivered</div>
            </div>
          </div>
        </div>
        </mj-raw>`.trim());
      }
      if (v === "finalize-delivery-date") {
        this.addAttributes({
          "data-variant": "finalize-delivery-date",
          "font-size": "16px",
          "font-weight": "400",
          align: "center",
          padding: "8px",
        });
        this.components(`<mj-raw>
        <div style="padding:12px 16px;background:#ffffff;">
          <div style="display:flex;align-items:flex-start;">
            <div style="flex:1;text-align:center;position:relative;">
              <!-- first half (completed) -->
              <div style="position:absolute;left:calc(50% + 14px);width:50%;top:14px;height:2px;background:#9b0034;"></div>

              <!-- second half (remaining) -->
              <div style="position:absolute;left:calc(50% + 14px + 50%);right:0;top:14px;height:2px;background:#d7d7d7;"></div>

              <span style="width:28px;height:28px;border-radius:50%;background:#9b0034;display:inline-flex;align-items:center;justify-content:center;margin:0 auto 8px;position:relative;z-index:1;">
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <path d="M6.3 11.3 3.4 8.4l-1 1 3.9 3.9L13.6 6l-1-1-6.3 6.3z" fill="#ffffff"/>
                </svg>
              </span>
              <div style="font-family:Arial;font-size:14px;font-weight:700;color:#9b0034;">Ordered</div>
              <div style="font-family:Arial;font-size:12px;color:#555555;margin-top:4px;white-space:nowrap;">Wed, Sep 14</div>
            </div>

            <div style="flex:1;text-align:center;position:relative;">
              <!-- left 25% (completed / colored) -->
              <div style="position:absolute;left:0;width:20%;top:14px;height:2px;background:#9b0034;"></div>

              <!-- remaining 75% (pending / gray) -->
              <div style="position:absolute;left:20%;right:0;top:14px;height:2px;background:#d7d7d7;"></div>

              <div style="position:absolute;left:calc(50% - 14px);width:28px;top:14px;height:2px;background:#ffffff;"></div>
              <span style="width:28px;height:28px;border-radius:50%;background:#cfcfcf;display:inline-block;margin:0 auto 8px;position:relative;z-index:1;"></span>
              <div style="font-family:Arial;font-size:14px;font-weight:600;color:#8a8a8a;">Shipped</div>
            </div>

            <div style="flex:1;text-align:center;position:relative;">
              <div style="position:absolute;left:0;right:calc(50% + 14px);top:14px;height:2px;background:#d7d7d7;"></div>
              <span style="width:28px;height:28px;border-radius:50%;background:#cfcfcf;display:inline-block;margin:0 auto 8px;position:relative;z-index:1;"></span>
              <div style="font-family:Arial;font-size:14px;font-weight:600;color:#8a8a8a;">Delivered</div>
            </div>
          </div>
        </div>
        </mj-raw>`.trim());
      }
      if (v === "order-processed") {
        this.addAttributes({
          "data-variant": "order-processed",
          "font-size": "16px",
          "font-weight": "400",
          align: "center",
          padding: "8px",
        });
        this.components(`<mj-raw>
        <div style="padding:12px 16px;background:#ffffff;">
          <div style="display:flex;align-items:flex-start;">
            <div style="flex:1;text-align:center;position:relative;">
              <!-- first half (completed) -->
              <div style="position:absolute;left:calc(50% + 14px);width:50%;top:14px;height:2px;background:#9b0034;"></div>

              <!-- second half (remaining) -->
              <div style="position:absolute;left:calc(50% + 14px + 50%);right:0;top:14px;height:2px;background:#d7d7d7;"></div>

              <span style="width:28px;height:28px;border-radius:50%;background:#9b0034;display:inline-flex;align-items:center;justify-content:center;margin:0 auto 8px;position:relative;z-index:1;">
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <path d="M6.3 11.3 3.4 8.4l-1 1 3.9 3.9L13.6 6l-1-1-6.3 6.3z" fill="#ffffff"/>
                </svg>
              </span>
              <div style="font-family:Arial;font-size:14px;font-weight:700;color:#9b0034;">Ordered</div>
              <div style="font-family:Arial;font-size:12px;color:#555555;margin-top:4px;white-space:nowrap;">Wed, Sep 14</div>
            </div>

            <div style="flex:1;text-align:center;position:relative;">
              <!-- LEFT half (Ordered → Shipped) : colored -->
              <div style="position:absolute;left:0;width:50%;top:14px;height:2px;background:#9b0034;"></div>

              <!-- RIGHT half (Shipped → Delivered) : gray -->
              <div style="position:absolute;left:50%;right:0;top:14px;height:2px;background:#d7d7d7;"></div>

              <!-- cut-out behind the circle -->
              <div style="position:absolute;left:calc(50% - 14px);width:28px;top:14px;height:2px;background:#ffffff;"></div>

              <!-- Shipped circle (active) -->
              <span style="width:28px;height:28px;border-radius:50%;background:#9b0034;display:inline-flex;align-items:center;justify-content:center;margin:0 auto 8px;position:relative;z-index:1;">
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <path d="M6.3 11.3 3.4 8.4l-1 1 3.9 3.9L13.6 6l-1-1-6.3 6.3z" fill="#ffffff"/>
                </svg>
              </span>

              <div style="font-family:Arial;font-size:14px;font-weight:700;color:#9b0034;">Shipped</div>
              <div style="font-family:Arial;font-size:12px;color:#555555;margin-top:4px;white-space:nowrap;">Wed, Sep 14</div>
            </div>

            <div style="flex:1;text-align:center;position:relative;">
              <div style="position:absolute;left:0;right:calc(50% + 14px);top:14px;height:2px;background:#d7d7d7;"></div>
              <span style="width:28px;height:28px;border-radius:50%;background:#cfcfcf;display:inline-block;margin:0 auto 8px;position:relative;z-index:1;"></span>
              <div style="font-family:Arial;font-size:14px;font-weight:600;color:#8a8a8a;">Delivered</div>
            </div>
          </div>
        </div>
        </mj-raw>`.trim());
      }
      if (v === "order-delivered") {
        this.addAttributes({
          "data-variant": "order-delivered",
          "font-size": "16px",
          "font-weight": "400",
          align: "center",
          padding: "8px",
        });
        this.components(`<mj-raw>
          <div style="padding:12px 16px;background:#ffffff;">
            <div style="display:flex;align-items:flex-start;">

              <!-- ORDERED -->
              <div style="flex:1;text-align:center;position:relative;">
                <div style="position:absolute;left:calc(50% + 14px);right:0;top:14px;height:2px;background:#9b0034;"></div>

                <span style="width:28px;height:28px;border-radius:50%;background:#9b0034;display:inline-flex;align-items:center;justify-content:center;margin:0 auto 8px;position:relative;z-index:1;">
                  <svg width="14" height="14" viewBox="0 0 16 16"><path d="M6.3 11.3 3.4 8.4l-1 1 3.9 3.9L13.6 6l-1-1-6.3 6.3z" fill="#ffffff"/></svg>
                </span>

                <div style="font-family:Arial;font-size:14px;font-weight:700;color:#9b0034;">Ordered</div>
                <div style="font-family:Arial;font-size:12px;color:#555555;margin-top:4px;white-space:nowrap;">Wed, Sep 14</div>
              </div>

              <!-- SHIPPED -->
              <div style="flex:1;text-align:center;position:relative;">

                <div style="position:absolute;left:0;right:0;top:14px;height:2px;background:#9b0034;"></div>

                <div style="position:absolute;left:calc(50% - 14px);width:28px;top:14px;height:2px;background:#ffffff;"></div>

                <span style="width:28px;height:28px;border-radius:50%;background:#9b0034;display:inline-flex;align-items:center;justify-content:center;margin:0 auto 8px;position:relative;z-index:1;">
                  <svg width="14" height="14" viewBox="0 0 16 16"><path d="M6.3 11.3 3.4 8.4l-1 1 3.9 3.9L13.6 6l-1-1-6.3 6.3z" fill="#ffffff"/></svg>
                </span>

                <div style="font-family:Arial;font-size:14px;font-weight:700;color:#9b0034;">Shipped</div>
                <div style="font-family:Arial;font-size:12px;color:#555555;margin-top:4px;white-space:nowrap;">Wed, Sep 14</div>
              </div>

              <!-- DELIVERED -->
              <div style="flex:1;text-align:center;position:relative;">
                <div style="position:absolute;left:0;right:calc(50% + 14px);top:14px;height:2px;background:#9b0034;"></div>

                <span style="width:28px;height:28px;border-radius:50%;background:#9b0034;display:inline-flex;align-items:center;justify-content:center;margin:0 auto 8px;position:relative;z-index:1;">
                  <svg width="14" height="14" viewBox="0 0 16 16"><path d="M6.3 11.3 3.4 8.4l-1 1 3.9 3.9L13.6 6l-1-1-6.3 6.3z" fill="#ffffff"/></svg>
                </span>

                <div style="font-family:Arial;font-size:14px;font-weight:700;color:#9b0034;">Delivered</div>
                <div style="font-family:Arial;font-size:12px;color:#555555;margin-top:4px;white-space:nowrap;">Wed, Sep 14</div>
              </div>

            </div>
          </div>
        </mj-raw>
        `.trim());
      }
    };

    // If timeline + missing data-variant: detect from existing mj-raw BEFORE writing anything
    if (isTimeline) {
      const a = this.getAttributes?.() || {};
      if (!a["data-variant"]) {
        // find existing mj-raw child
        let rawChild: any = null;
        this.components?.().forEach?.((c: any) => {
          if (c?.get?.("type") === "mj-raw") rawChild = c;
        });

        const rawText = rawChild ? getRawText(rawChild) : "";
        const detected = parseTimelineVariantFromRaw(rawText);

        if (detected) {
          // set attribute -> will trigger change:attributes below
          this.addAttributes?.({ "data-variant": detected });
        }
      }
    }

    applyVariant();

    // React to trait changes
    if (!this.__timelineBound) {
      this.__timelineBound = true;
      this.on("change:attributes", () => {
        const next = this.getAttributes?.()?.["data-variant"];
        if (next) applyVariant();
      });
    }
  };
}


const attachDynamicWrapperHelpers = (editor: Editor) => {
  const configs = [
    { wrapperClass: CLS.eachWrapper, placeholderClass: CLS.eachPlaceholder, placeholderText: "Drop loop content here (EACH)" },
    { wrapperClass: CLS.ifWrapper, placeholderClass: CLS.ifPlaceholder, placeholderText: "Drop conditional content here (IF/ELSE)" },
    { wrapperClass: CLS.unlessWrapper, placeholderClass: CLS.unlessPlaceholder, placeholderText: "Drop conditional content here (UNLESS)" },
    { wrapperClass: CLS.booleanWrapper, placeholderClass: CLS.booleanPlaceholder, placeholderText: "Drop boolean content here (placeholder)" },
  ] as const;

  const getCssClasses = (cmp: any) => {
    const cls = String(cmp?.getAttributes?.()?.["css-class"] || "");
    return cls.split(/\s+/).filter(Boolean);
  };

  const hasClass = (cmp: any, className: string) => getCssClasses(cmp).includes(className);

  const getConfigForComponent = (component?: GjsComponent | null) => {
    if (!component) return undefined;
    return configs.find((cfg) => hasClass(component, cfg.wrapperClass));
  };

  const hasRealChildren = (column: GjsComponent, config: (typeof configs)[number]) => {
    let result = false;
    column.components().forEach((child: GjsComponent) => {
      if (!hasClass(child, config.placeholderClass)) result = true;
    });
    return result;
  };

  const removePlaceholders = (column: GjsComponent, config: (typeof configs)[number]) => {
    if (!hasRealChildren(column, config)) return;
    const toRemove: GjsComponent[] = [];
    column.components().forEach((child: GjsComponent) => {
      if (hasClass(child, config.placeholderClass)) toRemove.push(child);
    });
    toRemove.forEach((placeholder) => placeholder.remove());
  };

  const addPlaceholderIfNeeded = (column: GjsComponent, config: (typeof configs)[number]) => {
    if (hasRealChildren(column, config)) return;

    let hasPlaceholder = false;
    column.components().forEach((child: GjsComponent) => {
      if (hasClass(child, config.placeholderClass)) hasPlaceholder = true;
    });
    if (hasPlaceholder) return;

    const added = column.append({
      type: "mj-text",
      content: config.placeholderText,
      attributes: {
        "css-class": config.placeholderClass,
        align: "center",
        color: "#94a3b8",
        "font-style": "italic",
        padding: "12px",
        "line-height": "1.4",
        "font-size": "14px",
      },
    });

    // ✅ make placeholder non-interactive via GrapesJS props (NOT mjml attrs)
    const arr = Array.isArray(added) ? added : [added];
    arr.forEach((cmp: any) => {
      cmp?.set?.({
        selectable: false,
        draggable: false,
        highlightable: false,
        hoverable: false,
        badgable: false,
      });
    });
  };

  // When any component is added inside a wrapper => remove placeholders
  editor.on("component:add", (component) => {
    // Don't trigger when the "initial sample" is added in boolean badge
    if (component && hasClass(component, CLS.initialSample)) return;

    const parent = component.parent?.();
    const config = getConfigForComponent(parent);
    if (parent && config) removePlaceholders(parent, config);
  });

  // When removed, if wrapper is empty => re-add placeholder
  editor.on("component:remove", (component, parent) => {
    const targetParent = parent || component.parent?.();
    const config = getConfigForComponent(targetParent);
    if (!targetParent || !config) return;

    if (hasRealChildren(targetParent, config)) removePlaceholders(targetParent, config);
    else addPlaceholderIfNeeded(targetParent, config);
  });

  // Ensure wrapper columns are droppable + placeholders are non-interactive after load
  editor.on("load", () => {
    const root = editor.DomComponents.getWrapper();

    configs.forEach((cfg) => {
      const wrappers = root?.find?.(`.${cfg.wrapperClass}`) || [];
      wrappers.forEach((w: any) => {
        setWrapperDroppable(w);
      });

      const placeholders = root?.find?.(`.${cfg.placeholderClass}`) || [];
      placeholders.forEach((p: any) => p?.set?.({
        selectable: false,
        draggable: false,
        highlightable: false,
        hoverable: false,
        badgable: false,
      }));
    });
  });

  // Ensure wrapper columns are droppable when components are added
  editor.on("component:add", (component) => {
    // Check if component is a wrapper column
    const config = getConfigForComponent(component);
    if (config) {
      setWrapperDroppable(component);
    }

    // Check if any parent is a wrapper column and ensure it's droppable
    let parent = component.parent?.();
    while (parent) {
      const parentConfig = getConfigForComponent(parent);
      if (parentConfig) {
        setWrapperDroppable(parent);
        break;
      }
      parent = parent.parent?.();
    }

    // Make placeholder text elements droppable (for column-compatible conditional blocks)
    const componentCls = String(component?.getAttributes?.()?.["css-class"] || "");
    if (componentCls.includes(CLS.ifPlaceholder) && component.get?.("type") === "mj-text") {
      // Make the placeholder text droppable so content can be dropped into it
      component.set?.({
        droppable: (draggedComponent: GjsComponent) => {
          const draggedType = draggedComponent?.get?.("type");
          if (draggedType?.startsWith("mj-")) return true;
          return true; // Allow blocks
        },
      });
    }
  });
};

const attachUnlessConditionEditor = (editor: Editor) => {
  const setPropsMode = (mode: "default" | "traitsOnly") => {
    const el = document.getElementById(PROPS_PANEL_ID);
    if (!el) return;
    if (mode === "traitsOnly") el.classList.add("props--traits-only");
    else el.classList.remove("props--traits-only");
  };

  const isUnlessWrapper = (cmp: any) => {
    const cls = String(cmp?.getAttributes?.()?.["css-class"] || "");
    return cls.split(/\s+/).includes(CLS.unlessWrapper);
  };

  const isUnlessRaw = (cmp: any) => {
    const cls = String(cmp?.getAttributes?.()?.["css-class"] || "");
    const list = cls.split(/\s+/);
    return list.includes(CLS.unlessOpen) || list.includes(CLS.unlessClose);
  };

  const isUnlessSection = (cmp: any) => {
    if (cmp?.get?.("type") !== "mj-section") return false;
    const cls = String(cmp?.getAttributes?.()?.["css-class"] || "");
    return cls.split(/\s+/).includes(CLS.unlessSection);
  };

  const findWrapperFromSection = (sectionCmp: any) => sectionCmp?.find?.(`.${CLS.unlessWrapper}`)?.[0] || null;

  const findWrapperFromRaw = (rawCmp: any) => {
    if (!isUnlessRaw(rawCmp)) return null;

    const parent = rawCmp.parent?.();
    const siblings = parent?.components?.();
    if (!siblings) return null;

    const idx = siblings.indexOf?.(rawCmp);
    if (typeof idx !== "number" || idx < 0) return null;

    const cls = String(rawCmp.getAttributes?.()?.["css-class"] || "");
    const isOpen = cls.split(/\s+/).includes(CLS.unlessOpen);
    const section = isOpen ? siblings.at?.(idx + 1) : siblings.at?.(idx - 1);
    if (!section) return null;

    return findWrapperFromSection(section);
  };

  const setRawContent = (rawCmp: any, text: string) => {
    rawCmp.components?.().reset?.();
    rawCmp.set?.("components", "");
    rawCmp.set?.("content", text);
  };

  const syncRaw = (wrapper: any) => {
    const cond = String(wrapper.get?.("unlessCondition") || DEFAULT_UNLESS_CONDITION).trim();

    let section = wrapper.parent?.();
    while (section && section.get?.("type") !== "mj-section") section = section.parent?.();
    const parent = section?.parent?.();
    if (!section || !parent) return;

    const siblings = parent.components?.();
    const idx = siblings.indexOf?.(section);
    if (typeof idx !== "number" || idx < 0) return;

    const prev = siblings.at?.(idx - 1);
    const next = siblings.at?.(idx + 1);

    const prevCls = String(prev?.getAttributes?.()?.["css-class"] || "");
    const nextCls = String(next?.getAttributes?.()?.["css-class"] || "");

    if (prev && prevCls.includes(CLS.unlessOpen)) setRawContent(prev, `{{#unless ${cond}}}`);
    if (next && nextCls.includes(CLS.unlessClose)) setRawContent(next, "{{/unless}}");
  };

  const ensureTrait = (wrapper: any) => {
    if (!isUnlessWrapper(wrapper)) return;

    if (!wrapper.get?.("unlessCondition")) wrapper.set?.("unlessCondition", DEFAULT_UNLESS_CONDITION);

    const hasTrait = (wrapper.getTraits?.() || []).some((t: any) => t.get?.("name") === "unlessCondition");

    if (!hasTrait) {
      wrapper.addTrait({
        type: "text",
        name: "unlessCondition",
        label: "Condition",
        placeholder: "Condition",
        changeProp: 1,
      });
    }

    if (!wrapper.__unlessBound) {
      wrapper.__unlessBound = true;
      wrapper.on?.("change:unlessCondition", () => syncRaw(wrapper));
      syncRaw(wrapper);
    }
  };

  editor.on("component:selected", (cmp) => {
    if (!cmp) {
      setPropsMode("default");
      return;
    }

    if (isUnlessRaw(cmp)) {
      const wrapper = findWrapperFromRaw(cmp);
      if (wrapper) {
        ensureTrait(wrapper);
        setPropsMode("traitsOnly");
        editor.select(wrapper);
      }
      return;
    }

    if (isUnlessSection(cmp)) {
      const wrapper = findWrapperFromSection(cmp);
      if (wrapper) {
        ensureTrait(wrapper);
        setPropsMode("traitsOnly");
        editor.select(wrapper);
      }
      return;
    }

    let cur = cmp;
    while (cur && cur.parent && !isUnlessWrapper(cur)) cur = cur.parent();
    if (isUnlessWrapper(cur)) {
      ensureTrait(cur);
      setPropsMode("traitsOnly");
      return;
    }

    setPropsMode("default");
  });

  editor.on("component:deselected", () => setPropsMode("default"));

  // Ensure wrapper columns are droppable when components are added
  editor.on("component:add", (component) => {
    // Check if the added component is an UNLESS wrapper column
    if (isUnlessWrapper(component)) {
      setWrapperDroppable(component);
    }

    // Check if any parent is an UNLESS wrapper and ensure it's droppable
    let parent = component.parent?.();
    while (parent) {
      if (isUnlessWrapper(parent)) {
        setWrapperDroppable(parent);
        break;
      }
      parent = parent.parent?.();
    }
  });

  editor.on("load", () => {
    const wrappers = editor.DomComponents.getWrapper()?.find?.(`.${CLS.unlessWrapper}`) || [];
    wrappers.forEach((w: any) => {
      ensureTrait(w);
      setWrapperDroppable(w);
    });
  });
};

const attachIfConditionEditor = (editor: Editor) => {
  const setPropsMode = (mode: "default" | "traitsOnly") => {
    const el = document.getElementById(PROPS_PANEL_ID);
    if (!el) return;
    if (mode === "traitsOnly") el.classList.add("props--traits-only");
    else el.classList.remove("props--traits-only");
  };

  const isIfWrapper = (cmp: any) => {
    const cls = String(cmp?.getAttributes?.()?.["css-class"] || "");
    return cls.split(/\s+/).includes(CLS.ifWrapper);
  };

  const isIfRaw = (cmp: any) => {
    const cls = String(cmp?.getAttributes?.()?.["css-class"] || "");
    const list = cls.split(/\s+/);
    return list.includes(CLS.ifOpen) || list.includes(CLS.ifClose);
  };

  const isIfSection = (cmp: any) => {
    if (cmp?.get?.("type") !== "mj-section") return false;
    const cls = String(cmp?.getAttributes?.()?.["css-class"] || "");
    const list = cls.split(/\s+/);
    return list.includes(CLS.ifSection) || list.includes(CLS.elseSection);
  };

  const findWrapperFromSection = (sectionCmp: any) => sectionCmp?.find?.(`.${CLS.ifWrapper}`)?.[0] || null;

  const findWrapperFromRaw = (rawCmp: any) => {
    if (!isIfRaw(rawCmp)) return null;

    const parent = rawCmp.parent?.();
    const siblings = parent?.components?.();
    if (!siblings) return null;

    const idx = siblings.indexOf?.(rawCmp);
    if (typeof idx !== "number" || idx < 0) return null;

    const cls = String(rawCmp.getAttributes?.()?.["css-class"] || "");
    const isOpen = cls.split(/\s+/).includes(CLS.ifOpen);
    const section = isOpen ? siblings.at?.(idx + 1) : siblings.at?.(idx - 1);
    if (!section) return null;

    return findWrapperFromSection(section);
  };

  const setRawContent = (rawCmp: any, text: string) => {
    rawCmp.components?.().reset?.();
    rawCmp.set?.("components", "");
    rawCmp.set?.("content", text);
  };

  const syncRaw = (wrapper: any) => {
    const cond = String(wrapper.get?.("ifCondition") || DEFAULT_IF_CONDITION).trim();

    let section = wrapper.parent?.();
    while (section && section.get?.("type") !== "mj-section") section = section.parent?.();
    const parent = section?.parent?.();
    if (!section || !parent) return;

    const siblings = parent.components?.();
    const idx = siblings.indexOf?.(section);
    if (typeof idx !== "number" || idx < 0) return;

    const prev = siblings.at?.(idx - 1);
    const next = siblings.at?.(idx + 1);

    const prevCls = String(prev?.getAttributes?.()?.["css-class"] || "");
    const nextCls = String(next?.getAttributes?.()?.["css-class"] || "");

    if (prev && prevCls.includes(CLS.ifOpen)) setRawContent(prev, `{{#if ${cond}}}`);
    if (next && nextCls.includes(CLS.ifClose)) setRawContent(next, "{{/if}}");
  };

  const ensureTrait = (wrapper: any) => {
    if (!isIfWrapper(wrapper)) return;

    if (!wrapper.get?.("ifCondition")) wrapper.set?.("ifCondition", DEFAULT_IF_CONDITION);

    const hasTrait = (wrapper.getTraits?.() || []).some((t: any) => t.get?.("name") === "ifCondition");

    if (!hasTrait) {
      wrapper.addTrait({
        type: "text",
        name: "ifCondition",
        label: "Condition",
        placeholder: "Condition",
        changeProp: 1,
      });
    }

    if (!wrapper.__ifBound) {
      wrapper.__ifBound = true;
      wrapper.on?.("change:ifCondition", () => syncRaw(wrapper));
      syncRaw(wrapper);
    }
  };

  editor.on("component:selected", (cmp) => {
    if (!cmp) {
      setPropsMode("default");
      return;
    }

    if (isIfRaw(cmp)) {
      const wrapper = findWrapperFromRaw(cmp);
      if (wrapper) {
        ensureTrait(wrapper);
        setPropsMode("traitsOnly");
        editor.select(wrapper);
      }
      return;
    }

    if (isIfSection(cmp)) {
      const wrapper = findWrapperFromSection(cmp);
      if (wrapper) {
        ensureTrait(wrapper);
        setPropsMode("traitsOnly");
        editor.select(wrapper);
      }
      return;
    }

    let cur = cmp;
    while (cur && cur.parent && !isIfWrapper(cur)) cur = cur.parent();
    if (isIfWrapper(cur)) {
      ensureTrait(cur);
      setPropsMode("traitsOnly");
      return;
    }

    setPropsMode("default");
  });

  editor.on("component:deselected", () => setPropsMode("default"));

  // Ensure wrapper columns are droppable when components are added
  editor.on("component:add", (component) => {
    // Check if the added component is an IF/ELSE wrapper column
    if (isIfWrapper(component)) {
      setWrapperDroppable(component);
    }

    // Check if any parent is an IF/ELSE wrapper and ensure it's droppable
    let parent = component.parent?.();
    while (parent) {
      if (isIfWrapper(parent)) {
        setWrapperDroppable(parent);
        break;
      }
      parent = parent.parent?.();
    }
  });

  editor.on("load", () => {
    const wrappers = editor.DomComponents.getWrapper()?.find?.(`.${CLS.ifWrapper}`) || [];
    wrappers.forEach((w: any) => {
      ensureTrait(w);
      setWrapperDroppable(w);
    });
  });
};

const enableNestedColumns = (editor: Editor) => {
  const domc = editor.DomComponents;


  // Helper to check if a column is an IF/ELSE/UNLESS/EACH wrapper
  const isWrapperColumn = (component: GjsComponent) => {
    if (!component) return false;
    const cls = String(component?.getAttributes?.()?.["css-class"] || "");
    const wrapperClasses = [CLS.ifWrapper, CLS.unlessWrapper, CLS.eachWrapper, CLS.booleanWrapper];
    return wrapperClasses.some(wc => cls.split(/\s+/).includes(wc));
  };

  // 1. Allow mj-column to ACCEPT sections and columns being dropped into it
  const columnType = domc.getType("mj-column");
  if (!columnType) return;

  const originalColumnModel = columnType.model;

  domc.addType("mj-column", {
    model: {
      defaults: {
        ...originalColumnModel.prototype.defaults,
        droppable: (draggedComponent: GjsComponent, targetComponent: GjsComponent) => {
          const draggedType = draggedComponent?.get?.("type");

          // If target is a wrapper column (IF/ELSE/UNLESS/EACH), allow all MJML components
          if (isWrapperColumn(targetComponent)) {
            // Allow all standard MJML components to be dropped into wrapper columns
            if (draggedType?.startsWith("mj-")) return true;
            // Also allow sections and columns for nested structures
            if (draggedType === "mj-column" || draggedType === "mj-section") return true;
            // Allow any component (for blocks from block manager)
            return true;
          }

          // For ALL columns (regular and wrapper), allow sections to be dropped
          // This allows boolean badge, conditional blocks, etc. to be dropped into columns
          if (draggedType === "mj-section") return true;

          // Allow mj-raw elements (for conditional blocks with {{#if}}, {{/if}}, etc.)
          if (draggedType === "mj-raw") return true;

          // Allow columns to be dropped into columns (for nested columns)
          if (draggedType === "mj-column") return true;

          // Allow all MJML components in regular columns
          if (draggedType?.startsWith("mj-")) return true;

          const originalDroppable = originalColumnModel.prototype.defaults.droppable;
          if (typeof originalDroppable === "function") {
            return originalDroppable(draggedComponent, targetComponent);
          }
          if (typeof originalDroppable === "string") {
            const selector = originalDroppable;
            const el = draggedComponent?.getEl?.();
            return el?.matches?.(selector) ?? true;
          }
          // Default: allow drops (for blocks from block manager)
          return true;
        },
      },
    },
  });

  // 2. Allow mj-section to BE DRAGGED into columns (not just mj-body/mj-wrapper)
  const sectionType = domc.getType("mj-section");
  if (sectionType) {
    const originalSectionModel = sectionType.model;

    domc.addType("mj-section", {
      model: {
        defaults: {
          ...originalSectionModel.prototype.defaults,
          // Allow sections to be dragged into mj-body, mj-wrapper, AND mj-column
          draggable: '[data-gjs-type="mj-body"], [data-gjs-type="mj-wrapper"], [data-gjs-type="mj-column"]',
        },
      },
    });
  }

  // 3. Allow mj-raw to BE DRAGGED into columns (for conditional blocks)
  const rawType = domc.getType("mj-raw");
  if (rawType) {
    const originalRawModel = rawType.model;

    domc.addType("mj-raw", {
      model: {
        defaults: {
          ...originalRawModel.prototype.defaults,
          // Allow mj-raw to be dragged into mj-body, mj-wrapper, AND mj-column
          draggable: '[data-gjs-type="mj-body"], [data-gjs-type="mj-wrapper"], [data-gjs-type="mj-column"]',
        },
      },
    });
  }

  editor.on("component:add", (addedComponent: GjsComponent) => {
    const addedType = addedComponent?.get?.("type");
    const parent = addedComponent.parent?.();
    const parentType = parent?.get?.("type");

    if (parentType !== "mj-column") return;

    // Don't apply nested column logic to wrapper columns (IF/EACH/UNLESS/BOOLEAN)
    // All wrapper columns work the same way
    if (isWrapperColumn(parent)) {
      // For wrapper columns, just allow normal component addition (same as boolean badge)
      if (addedType === "mj-section") {
        addedComponent.addAttributes({ padding: "0" });
        editor.select(addedComponent);
      }
      return;
    }

    // Handle sections being added to regular columns
    // Works EXACTLY the same for ALL blocks (boolean badge, conditional, etc.)
    if (addedType === "mj-section") {
      // Set padding to 0 for sections inside columns (same as boolean badge)
      addedComponent.addAttributes({ padding: "0" });
      editor.select(addedComponent);
      return;
    }

    // Handle mj-raw elements (from conditional blocks) - keep them inside columns
    if (addedType === "mj-raw") {
      const rawContent = addedComponent.get?.("content") || "";
      // Check if it's a conditional block raw tag ({{#if}}, {{/if}}, etc.)
      if (rawContent.includes("{{#if") || rawContent.includes("{{/if") ||
        rawContent.includes("{{#unless") || rawContent.includes("{{/unless") ||
        rawContent.includes("{{else}}")) {
        // This is part of a conditional block - keep it inside the column
        // No special handling needed, just let it stay
        return;
      }
    }

    if (addedType === "mj-column") {
      const droppedColumn = addedComponent;
      const parentColumn = parent;

      droppedColumn.remove();

      parentColumn.append(`
        <mj-section padding="0">
          <mj-column>
            <mj-text padding="10px" font-size="14px" color="#64748b" align="center">Nested Column 1</mj-text>
          </mj-column>
          <mj-column>
            <mj-text padding="10px" font-size="14px" color="#64748b" align="center">Nested Column 2</mj-text>
          </mj-column>
        </mj-section>
      `);

      const nestedSection = parentColumn.components().at(-1);
      if (nestedSection) {
        editor.select(nestedSection);
      }
    }
  });
};

const attachEachItemsEditor = (editor: Editor) => {
  const isEachWrapper = (cmp: any) => {
    const cls = String(cmp?.getAttributes?.()?.["css-class"] || "");
    return cls.split(/\s+/).includes(CLS.eachWrapper);
  };

  const isEachRaw = (cmp: any) => {
    const cls = String(cmp?.getAttributes?.()?.["css-class"] || "");
    const list = cls.split(/\s+/);
    return list.includes(CLS.eachOpen) || list.includes(CLS.eachClose);
  };

  const findWrapperFromSection = (sectionCmp: any) => sectionCmp?.find?.(`.${CLS.eachWrapper}`)?.[0] || null;

  const findWrapperFromRaw = (rawCmp: any) => {
    if (!isEachRaw(rawCmp)) return null;

    const parent = rawCmp.parent?.();
    const siblings = parent?.components?.();
    if (!siblings) return null;

    const idx = siblings.indexOf?.(rawCmp);
    if (typeof idx !== "number" || idx < 0) return null;

    const cls = String(rawCmp.getAttributes?.()?.["css-class"] || "");
    const isOpen = cls.split(/\s+/).includes(CLS.eachOpen);
    const section = isOpen ? siblings.at?.(idx + 1) : siblings.at?.(idx - 1);
    if (!section) return null;

    return findWrapperFromSection(section);
  };

  const setRawContent = (rawCmp: any, text: string) => {
    rawCmp.components?.().reset?.();
    rawCmp.set?.("components", "");
    rawCmp.set?.("content", text);
  };

  const syncRaw = (wrapper: any) => {
    const itemsKey = String(wrapper.get?.("eachItems") || DEFAULT_EACH_ITEMS).trim();

    let section = wrapper.parent?.();
    while (section && section.get?.("type") !== "mj-section") section = section.parent?.();
    const parent = section?.parent?.();
    if (!section || !parent) return;

    const siblings = parent.components?.();
    const idx = siblings.indexOf?.(section);
    if (typeof idx !== "number" || idx < 0) return;

    const prev = siblings.at?.(idx - 1);
    const next = siblings.at?.(idx + 1);

    const prevCls = String(prev?.getAttributes?.()?.["css-class"] || "");
    const nextCls = String(next?.getAttributes?.()?.["css-class"] || "");

    if (prev && prevCls.includes(CLS.eachOpen)) setRawContent(prev, `{{#each ${itemsKey}}}`);
    if (next && nextCls.includes(CLS.eachClose)) setRawContent(next, "{{/each}}");
  };

  const ensureTrait = (wrapper: any) => {
    if (!isEachWrapper(wrapper)) return;

    if (!wrapper.get?.("eachItems")) wrapper.set?.("eachItems", DEFAULT_EACH_ITEMS);

    const hasTrait = (wrapper.getTraits?.() || []).some((t: any) => t.get?.("name") === "eachItems");

    if (!hasTrait) {
      wrapper.addTrait({
        type: "text",
        name: "eachItems",
        label: "Items key",
        placeholder: "e.g. items, products, order.items",
        changeProp: 1,
      });
    }

    if (!wrapper.__eachBound) {
      wrapper.__eachBound = true;
      wrapper.on?.("change:eachItems", () => syncRaw(wrapper));
      syncRaw(wrapper);
    }
  };

  editor.on("component:selected", (cmp) => {
    if (!cmp) return;

    if (isEachRaw(cmp)) {
      const wrapper = findWrapperFromRaw(cmp);
      if (wrapper) {
        ensureTrait(wrapper);
        editor.select(wrapper);
      }
      return;
    }

    if (cmp.get?.("type") === "mj-section") {
      const wrapper = findWrapperFromSection(cmp);
      if (wrapper) {
        ensureTrait(wrapper);
        editor.select(wrapper);
      }
      return;
    }

    let cur = cmp;
    while (cur && cur.parent && !isEachWrapper(cur)) cur = cur.parent();
    if (isEachWrapper(cur)) ensureTrait(cur);
  });

  // Ensure wrapper columns are droppable when components are added
  editor.on("component:add", (component) => {
    // Check if the added component is an EACH wrapper column
    if (isEachWrapper(component)) {
      setWrapperDroppable(component);
    }

    // Check if any parent is an EACH wrapper and ensure it's droppable
    let parent = component.parent?.();
    while (parent) {
      if (isEachWrapper(parent)) {
        setWrapperDroppable(parent);
        break;
      }
      parent = parent.parent?.();
    }
  });

  editor.on("load", () => {
    const wrappers = editor.DomComponents.getWrapper()?.find?.(`.${CLS.eachWrapper}`) || [];
    wrappers.forEach((w: any) => {
      ensureTrait(w);
      setWrapperDroppable(w);
    });
  });
};

interface EmailFlowBuilderProps {
  loadTemplateId?: number | null;
  isNew?: boolean;
  templates?: Array<{ emailTemplateId: number; templateName: string }>;
  selectedTemplateId?: string | null;
  onTemplateSelect?: (templateId: string) => void;
  onLoadTemplate?: () => void;
  isLoadingTemplates?: boolean;
}

export function EmailFlowBuilder({
  loadTemplateId,
  isNew = false,
  templates = [],
  selectedTemplateId = null,
  onTemplateSelect,
  onLoadTemplate,
  isLoadingTemplates = false,
}: EmailFlowBuilderProps) {
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [_activeDevice, _setActiveDevice] = useState<Device>("Desktop");
  const [showPropertiesHint, setShowPropertiesHint] = useState(true);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const [_templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("Description");
  const [_subjectLine, setSubjectLine] = useState("");
  const [publish, setPublish] = useState(false);
  
  // Track created template ID after first save (for new templates)
  const [createdTemplateId, setCreatedTemplateId] = useState<number | undefined>(undefined);

  const pathname = window.location.pathname;
  const slug = pathname.split("/").pop();

  // Use prop isNew if provided, otherwise check from URL
  const isNewPage = isNew !== undefined ? isNew : (slug === "new");
  const isEdit = slug !== "new" && !isNaN(Number(slug));

  const templateId = isEdit ? Number(slug) : createdTemplateId;

  const loadedTemplateIdRef = useRef<number | null>(null);
  // Ref to store save context for toast messages
  const saveContextRef = useRef<{ shouldPublish: boolean; wasPublished: boolean } | null>(null);

  // Determine which template ID to load (from URL or from props)
  const activeTemplateId = templateId || loadTemplateId;

  // Use useQuery to fetch template details
  const { data: templateData, isLoading: _isLoadingTemplate, error: _templateError } = useQuery({
    queryKey: [`getTemplateDetails-${activeTemplateId}`, { templateId: activeTemplateId }],
    queryFn: () => {
      if (!activeTemplateId) return Promise.resolve(null);
      return getTemplateDetails({ templateId: activeTemplateId });
    },
    enabled: !!activeTemplateId && isReady, // Only fetch when we have an ID and editor is ready
  });

  const createTemplateMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: (data) => {
      if (data?.emailTemplateId) {
        setCreatedTemplateId(data.emailTemplateId);
      }
      if (data?.status != null) {
        setPublish(data.status === "PUBLISHED");
      }
      
      const context = saveContextRef.current;
      if (context?.shouldPublish) {
        toast.success("Template published successfully and is now live");
      } else {
        toast.success("Template saved as draft successfully");
      }
      saveContextRef.current = null;
    },
    onError: (error: AxiosError) => {
      const context = saveContextRef.current;
      const errorResponse = (error.response?.data as any)?.errors;
      
      if (context?.shouldPublish) {
        if (error.response?.status === 400 || errorResponse?.errors) {
          toast.error("Cannot publish template. Validation failed.");
        } else {
          toast.error("Failed to publish template. Something went wrong, please try again");
        }
      } else {
        toast.error("Failed to save template. Please try again");
      }
      saveContextRef.current = null;
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: updateTemplateDetails,
    onSuccess: (data) => {
      if (data?.status != null) {
        setPublish(data.status === "PUBLISHED");
      }

      const context = saveContextRef.current;
      if (context?.shouldPublish) {
        if (context.wasPublished) {
          toast.success("Template updated and published successfully");
        } else {
          toast.success("Template published successfully and is now live");
        }
      } else {
        toast.success("Template saved as draft successfully");
      }
      saveContextRef.current = null;
    },
    onError: (error: AxiosError) => {
      const context = saveContextRef.current;
      const errorResponse = (error.response?.data as any)?.errors;
      
      if (context?.shouldPublish) {
        if (error.response?.status === 400 || errorResponse?.errors) {
          toast.error("Cannot publish template. Validation failed.");
        } else {
          toast.error("Failed to publish template. Something went wrong, please try again");
        }
      } else {
        toast.error("Failed to save template. Please try again");
      }
      saveContextRef.current = null;
    },
  });

  const isSaving = createTemplateMutation.isPending || updateTemplateMutation.isPending;

  useEffect(() => {
    if (!editorContainerRef.current) return;

    const editor = grapesjs.init({
      container: editorContainerRef.current,
      height: "100%",
      width: "100%",
      fromElement: false,
      storageManager: false,
      selectorManager: { componentFirst: true },
      components: INITIAL_MJML_TEMPLATE,
      blockManager: { appendTo: `#${BLOCKS_PANEL_ID}` },
      traitManager: { appendTo: `#${TRAITS_PANEL_ID}` },
      styleManager: { appendTo: `#${PROPS_PANEL_ID}` },
      deviceManager: {
        devices: [
          { name: "Desktop", width: "" },
          { name: "Mobile", width: "375px" },
        ],
      },
      panels: { defaults: [] },
      canvas: {
        styles: ["https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"],
        frameStyle: `
          [data-gjs-type="mj-body"] { 
            padding-bottom: 150px !important; 
            min-height: 100vh !important; 
          }
        `,
      },
      plugins: [mjmlPlugin],
      pluginsOpts: {
        "grapesjs-mjml": {
          columnsPadding: "12px",
          resetDevices: false,
        },
      },
    });

    editor.on("load", () => {
      enableMjTextVariants(editor);
      registerCustomBlocks(editor);
      enableNestedColumns(editor);
      attachIfConditionEditor(editor);
      attachUnlessConditionEditor(editor);
      attachDynamicWrapperHelpers(editor);
      attachEachItemsEditor(editor);
      registerHandlebarsImageTrait(editor);
      hydrateDynamicTraits(editor);
      hydrateTimelineTraits(editor);
      editor.setDevice("Desktop");
      applyDeviceWidth(editor, "Desktop");
      setIsReady(true);
    });

    editor.on("component:selected", (component) => {
      setShowPropertiesHint(!component || component.is("wrapper"));
    });
    editor.on("component:deselected", () => setShowPropertiesHint(true));

    editorRef.current = editor;
    // @ts-expect-error Temporary debug exposure
    window.editor = editor;

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, []);

  void function _withEditor(callback: (editor: Editor) => void) {
    const editor = editorRef.current;
    if (!editor) return;
    callback(editor);
  };

  const applyDeviceWidth = (editor: Editor, device: Device) => {
    const width = device === "Mobile" ? "375px" : "100%";

    const frameEl = editor.Canvas.getFrameEl();
    const frameWrapper = frameEl?.closest?.(".gjs-frame-wrapper") as HTMLElement | null;

    if (frameWrapper) {
      frameWrapper.style.width = width;
      frameWrapper.style.margin = device === "Mobile" ? "0 auto" : "0";
      frameWrapper.style.border = device === "Mobile" ? "1px solid #e5e7eb" : "none";
      frameWrapper.style.borderRadius = device === "Mobile" ? "12px" : "0";
      frameWrapper.style.overflow = "hidden";
    }

    editor.setDevice(device);
  };

  // const handlePreview = () => {
  //   withEditor((editor) => {
  //     try {
  //       const mjml = sanitizeMjml(editor.getHtml());
  //       const { html, errors } = mjml2html(mjml, { validationLevel: "soft" });
  //       if (errors?.length) console.error("MJML errors:", errors);
  //       setPreviewHtml(html);
  //     } catch (error) {
  //       console.error(error);
  //       alert("Unable to render preview. Check the console for details.");
  //     }
  //   });
  // };

  const handleClosePreview = () => setPreviewHtml(null);

  // const handleTestSend = () => {
  // alert("Hook your ESP API here to send a test email.");
  // withEditor((editor) => {
  //     const mjml = sanitizeMjml(editor.getHtml());
  //     const { html, errors } = mjml2html(mjml, { validationLevel: "soft" });
  //     if (errors?.length) console.error("MJML errors:", errors);
  //     console.log("MJML:", mjml);
  //     console.log("HTML:", html);
  //   });
  // };

  // ✅ One function to build payload
  const buildPayload = (editor: Editor, publish: boolean, name: string, subjectLine: string): any | null => {
    const mjmlRaw = editor.getHtml();
    let mjml = sanitizeMjml(mjmlRaw);

    // Only wrap variable-like src values
    mjml = mjml.replace(
      /src="([^"]+)"/g,
      (match, val) => {
        // already handlebars
        if (val.startsWith("{{") && val.endsWith("}}")) return match;

        // real URLs → leave alone
        if (
          val.startsWith("http") ||
          val.startsWith("//") ||
          val.startsWith("data:")
        ) {
          return match;
        }

        // otherwise treat as variable
        return `src="{{${val}}}"`;
      }
    );

    const desc = description.trim();

    // if (!name) return alert("Template name is required."), null;
    // if (!subject) return alert("Subject line is required."), null;
    if (!mjml || !mjml.includes("<mjml") || !mjml.includes("<mj-body")) {
      if (publish) {
        toast.error("Cannot publish template. Validation failed.");
      }
      return null;
    }

    try {
      // Use "skip" validation level to be more lenient with conditional blocks
      const { errors } = mjml2html(mjml, { validationLevel: "skip" });
      if (errors?.length) {
        console.error("MJML errors:", errors);
        if (publish) {
          toast.error("Cannot publish template. Validation failed.");
        }
        return null;
      }
    } catch (e) {
      console.error("MJML validation exception:", e);
      if (publish) {
        toast.error("Cannot publish template. Validation failed.");
      }
      return null;
    }

    return {
      templateName: name,
      description: desc,
      subjectLine: subjectLine,
      templateBodyMjml: mjml,
      publish,
    };
  };

  // ✅ Save: POST if new, PUT if edit
  // `shouldPublish` = true when user clicks Publish / Save & Publish button
  const handleSaveTemplate = async (shouldPublish = false) => {
    if (isSaving) return;

    const ok = await form.trigger(["templateName", "subjectLine"]);
    if (!ok) return;

    const editor = editorRef.current;
    if (!editor) return;

    const name = form.getValues("templateName").trim();
    const subjectLine = form.getValues("subjectLine").trim();

    const payload = buildPayload(editor, shouldPublish, name, subjectLine);
    if (!payload) return;

    // Previous published state before this save
    const wasPublished = publish;

    // Store context for mutation callbacks
    saveContextRef.current = { shouldPublish, wasPublished };

    // If we have a templateId (either from URL or from previous save), update it
    if (templateId) {
      updateTemplateMutation.mutate({ templateId, payload });
    } else {
      createTemplateMutation.mutate({ payload });
    }
  };

  const formSchema = z.object({
    templateName: z.string().min(1, "Required"),
    subjectLine: z.string().min(1, "Required"),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      templateName: "",
      subjectLine: "",
    },
  });

  // Load template function (reusable) - applies template data to editor
  const loadTemplateIntoEditor = (data: Template, id: number) => {
    if (!isReady || !editorRef.current) return;
    if (loadedTemplateIdRef.current === id) return;
    
    // Check if this is loading a pre-built template (loadTemplateId) vs editing existing template
    const isLoadTemplate = loadTemplateId && loadTemplateId === id && isNewPage;
    
    setPublish(isLoadTemplate ? false : data.status === "PUBLISHED");
    
    // Reset createdTemplateId when loading a template (we're starting fresh)
    if (isLoadTemplate) {
      setCreatedTemplateId(undefined);
    }
    
    // For load template, append "_copy" to the name
    const originalName = data.templateName || "";
    const originalSubject = data.subjectLine || "";
    const name = isLoadTemplate ? `${originalName}_copy` : originalName;
    const subject = isLoadTemplate ? `${originalSubject}_copy`: originalSubject
    form.reset(
      { templateName: name, subjectLine: subject },
      { keepDirty: false, keepTouched: false },
    );

    const mjml = data.templateBodyMjml;
    const editor = editorRef.current;

    if (editor && mjml) {
      const cleaned = sanitizeMjml(mjml);
      editor.setComponents(cleaned);
      // Rehydrate traits/props from the saved mj-raw handlebars blocks
      hydrateDynamicTraits(editor);
      hydrateTimelineTraits(editor);
    }

    setTemplateName(name);
    setSubjectLine(subject);
    setDescription(data.description || "");

    loadedTemplateIdRef.current = id;

    if (isLoadTemplate) {
      toast.success("Template loaded successfully");
    }
  };

  // Reset createdTemplateId when starting a new template (not editing from URL)
  useEffect(() => {
    if (isNewPage && !isEdit) {
      setCreatedTemplateId(undefined);
    }
  }, [isNewPage, isEdit]);

  // Apply template data to editor when loaded via useQuery
  useEffect(() => {
    if (!templateData || !activeTemplateId) return;
    loadTemplateIntoEditor(templateData, activeTemplateId);
  }, [templateData, activeTemplateId, isReady, form, loadTemplateId, isNewPage]);

  return (
    <div className="builder">
      <header className="builder__header">
        <div className="flex items-center gap-3">
          {/* Template selection dropdown and load button - only for new page */}


          <Controller
            name="templateName"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                orientation="horizontal"
              >
                <InputGroup className="border-none">
                  <Input
                    {...field}
                    type="text"
                    className="font-bold border-0 shadow-none border-b-2 rounded-none border-b-destructive"
                    value={field.value ?? ""}
                    onChange={(e) => {
                      field.onChange(e);        // ✅ inform RHF
                      setTemplateName(e.target.value); // optional
                    }}
                    required
                    placeholder="Template name"
                    name="templateName"
                  />
                  <InputGroupAddon align="inline-end">
                    <SquarePenIcon className="text-destructive" />
                  </InputGroupAddon>
                </InputGroup>
                {fieldState.error && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="subjectLine"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                orientation="horizontal"
              >
                <InputGroup className="border-none">
                  <Input
                    {...field}
                    type="text"
                    className="font-bold border-0 shadow-none border-b-2 rounded-none border-b-destructive"
                    value={field.value ?? ""}
                    onChange={(e) => {
                      field.onChange(e);
                      setSubjectLine(e.target.value); 
                    }}
                    required
                    placeholder="Subject"
                    name="subjectLine"
                  />
                  <InputGroupAddon align="inline-end">
                    <SquarePenIcon className="text-destructive" />
                  </InputGroupAddon>
                </InputGroup>
                {fieldState.error && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          {isNewPage && onTemplateSelect && (
            <>
              <Combobox
                value={selectedTemplateId || null}
                onValueChange={onTemplateSelect}
                options={(templates || []).map((template) => ({
                  value: template.emailTemplateId,
                  label: template.templateName,
                }))}
                placeholder="Select Template..."
                searchPlaceholder="Search templates..."
                emptyText="No templates found."
                className="w-[250px]"
              />

              <Button
                onClick={onLoadTemplate}
                disabled={!selectedTemplateId || isLoadingTemplates}
                variant={selectedTemplateId ? "destructive" : "outline"}
                className="gap-2"
              >
                <DownloadIcon className="size-4" />
                Load Template
              </Button>
            </>
          )}

          {/* <Input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mb-1"
            placeholder="Description"
          />

          <Input
            type="text"
            value={subjectLine}
            onChange={(e) => setSubjectLine(e.target.value)}
            placeholder="Subject line"
          /> */}
        </div>

        <div className="builder__actions">
          {/* <div className="devices">
            {(["Desktop", "Mobile"] as Device[]).map((device) => (
              <button
                key={device}
                type="button"
                className={device === activeDevice ? "active" : ""}
                onClick={() => handleDeviceChange(device)}
              >
                {device}
              </button>
            ))}
          </div> */}

          {/* <button type="button" onClick={handlePreview}>
            Preview
          </button>

          <button type="button" onClick={handleTestSend}>
            Test Send
          </button> */}

          {/* <button
            type="button"
            className="primary"
            onClick={() => handleSaveTemplate(false)}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : isEdit ? "Update Template" : "Save Draft"}
          </button> */}

         {!publish && (
          <Button
            variant="outline"
            className="outlined"
            disabled={isSaving}
            onClick={() => handleSaveTemplate(false)}
          >
            <Save />
            {isSaving ? "Saving..." : "Save Draft"}
          </Button>
          )}
          {!publish ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="primary" variant="destructive" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Publish"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Publish template?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to publish {form.watch("templateName")?.trim() || "this template"}? Once published, you cannot update the email structure and template variables.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className={buttonVariants({ variant: "destructive" })}
                    onClick={() => handleSaveTemplate(true)}
                  >
                    Publish
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="primary"
                  variant="destructive"
                  disabled={isSaving}
                >
                  <Save />
                  {isSaving ? "Saving..." : "Save & Publish"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Save & Publish?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to publish {form.watch("templateName")?.trim() || "this template"}? This will go live immediately with current changes if it has been used in any active flow.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className={buttonVariants({ variant: "destructive" })}
                    onClick={() => handleSaveTemplate(true)}
                  >
                    Save & Publish
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>

      <div className="builder__body">
        <aside className="sidebar">
          <p className="sidebar__heading">Components</p>
          <div id={BLOCKS_PANEL_ID} className="sidebar__panel" />
        </aside>
        <div className="builder__center">
          <div className="w-[625px] max-w-full justify-center">
            <InfoBanner>
              <p className="flex-1 text-sm leading-relaxed text-slate-700">
                Tip: Insert variables using <span className="rounded-md bg-sky-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800">
                  {"{{custom_variable}}"}
                </span> for text or <span className="rounded-md bg-sky-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800">
                  {"{{{variable_name}}}"}
                </span> for HTML.
              </p>
            </InfoBanner>
            { templateData && templateData.status === "PUBLISHED" &&
            <InfoBanner>
                <p className="flex-1 text-sm leading-relaxed text-slate-700">
                  Published templates are locked to protect active flows. You can edit content, but structure and variables cannot be changed. Need major changes? Create a new version instead.
                </p>
            </InfoBanner>
            }
          </div>
          <div className="canvas">
            {!isReady && <div className="canvas__loading">Preparing editor…</div>}
            <div ref={editorContainerRef} className="canvas__surface" />
          </div>
        </div>

        <aside className="sidebar">
          <p className="sidebar__heading">Properties</p>
          <div id={PROPS_PANEL_ID} className="sidebar__panel sidebar__panel--props">
            {showPropertiesHint && (
              <div className="placeholder">
                <p>Select a component to edit its properties.</p>
              </div>
            )}
          </div>

          <p className="sidebar__heading">Traits</p>
          <div id={TRAITS_PANEL_ID} className="sidebar__panel sidebar__panel--props">
            {showPropertiesHint && (
              <div className="placeholder">
                <p>Select a component to edit its traits.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {previewHtml && (
        <div className="preview-overlay" role="dialog" aria-modal="true">
          <div className="preview-modal">
            <header>
              <p>Email preview</p>
              <button type="button" onClick={handleClosePreview}>
                Close
              </button>
            </header>
            <iframe title="Email preview" srcDoc={previewHtml} />
          </div>
        </div>
      )}
    </div>
  );
}

export default EmailFlowBuilder;
