import * as Objects from "@paperbits/common/objects";
import * as Utils from "@paperbits/common/utils";
import { BreakpointValues } from "@paperbits/common/styles/breakpoints";
import { LocalStyles } from "@paperbits/common/styles/localStyles";
import { PluginBag } from "@paperbits/common/styles/pluginBagContract";
import { StylePluginConfig } from "@paperbits/common/styles/stylePluginConfig";
import { CalcExpression, Size } from "./size";
import { Display } from "./plugins";
import { ViewManager } from "@paperbits/common/ui";


class StyleConfigurator {
    constructor(private readonly localStyles: LocalStyles) { }

    public plugin(pluginName: string): PluginStyleConfigurator {
        return new PluginStyleConfigurator(this.localStyles, pluginName);
    }

    public component(name: string): ComponentStyleConfigurator {
        return new ComponentStyleConfigurator(this.localStyles, name);
    }
}

class PluginStyleConfigurator {
    constructor(
        private readonly localStyles: LocalStyles,
        private readonly name: string) { }

    public setConfig(value: StylePluginConfig, viewport?: string): void {
        StyleHelper.setPluginConfigForLocalStyles(this.localStyles, this.name, value || null, viewport);
    }

    public getConfig<TStylePlugin>(viewport?: string): TStylePlugin {
        return <TStylePlugin>StyleHelper.getPluginConfigForLocalStyles(this.localStyles, this.name, viewport);
    }
}

class ComponentStyleConfigurator {
    constructor(
        private readonly localStyles: LocalStyles,
        private readonly componentName: string
    ) { }

    public variation(variationName: string): VariationStyleConfigurator {
        if (!/^\w*$/gm.test(variationName)) {
            throw new Error(`Invalid component variation name: "${variationName}"`);
        }

        return new VariationStyleConfigurator(this.localStyles, this.componentName, variationName);
    }
}

class VariationStyleConfigurator {
    constructor(
        private readonly localStyles: LocalStyles,
        private readonly componentName: string,
        private readonly variationName: string
    ) { }

    public plugin(name: string): PluginStyleConfigurator {
        if (!/^\w*$/gm.test(name)) {
            throw new Error(`Invalid style plugin name: "${name}"`);
        }

        return new PluginStyleConfigurator(this.localStyles, `components/${this.componentName}/${this.variationName}/${name}`);
    }
}

export class StyleHelper {
    private static isResponsive(variation: Object): boolean {
        if (!variation) {
            throw new Error(`Parameter "variation" not specified.`);
        }

        return Object.keys(variation).some(props => Object.keys(BreakpointValues).includes(props));
    }

    public static getPluginConfigForLocalStyles(localStyles: LocalStyles, pluginName: string, viewport: string = "xs"): StylePluginConfig {
        if (!localStyles) {
            throw new Error(`Parameter "localStyles" not specified.`);
        }

        if (!pluginName) {
            throw new Error(`Parameter "pluginName" not specified.`);
        }

        if (!localStyles.instance) {
            return null;
        }

        const pluginConfig = Objects.getObjectAt(pluginName, localStyles.instance);

        if (!pluginConfig) {
            return null;
        }

        const isResponsive = this.isResponsive(pluginConfig);

        if (isResponsive) {
            /* 
                If viewport not specified for requested viewport take closest lower viewport.
                We can uncomment this when we'll be able to collapse breakpoints for child properties with same values.
                For example: { size: { md: { width: 100 }, xs: { width: 100 } } } - collapses into { size: { xs: { width: 100 } } }

                const breakpoint = Utils.getClosestBreakpoint(pluginConfig, viewport);
            */

            const breakpoint = viewport;

            return <StylePluginConfig>pluginConfig[breakpoint];
        }
        else {
            return <StylePluginConfig>pluginConfig;
        }
    }

    /**
     * Updates local styles configuration depending on specified viewport. If viewport not specified, the style gets applied to all viewports.
     * @param localStyles Local styles object.
     * @param pluginName Name of the style plugin, e.g. "background".
     * @param pluginConfig Style plugin configuration object.
     * @param viewport Requested viewport. If viewport not specified, the style gets applied to all viewports.
     */
    public static setPluginConfigForLocalStyles(localStyles: LocalStyles, pluginName: string, pluginConfig: StylePluginConfig, viewport?: string): void {
        const pluginBag = localStyles.instance || {};
        StyleHelper.setPluginConfig(pluginBag, pluginName, pluginConfig || null, viewport);
        localStyles.instance = pluginBag;
    }

    public static getPluginConfig(pluginBag: PluginBag, pluginName: string, viewport: string = "xs"): StylePluginConfig {
        if (!pluginBag) {
            throw new Error(`Parameter "pluginBag" not specified.`);
        }

        if (!pluginName) {
            throw new Error(`Parameter "pluginName" not specified.`);
        }

        const pluginConfig = pluginBag[pluginName];

        if (!pluginConfig) {
            return null;
        }

        const isResponsive = this.isResponsive(pluginConfig);

        if (isResponsive) {
            /* 
                If viewport not specified for requested viewport take closest lower viewport.
                We can uncomment this when we'll be able to collapse breakpoints for child properties with same values.
                For example: { size: { md: { width: 100 }, xs: { width: 100 } } }

                const breakpoint = Utils.getClosestBreakpoint(pluginConfig, viewport);
            */

            const breakpoint = viewport;

            return <StylePluginConfig>pluginConfig[breakpoint];
        }
        else {
            return <StylePluginConfig>pluginConfig;
        }
    }

    /**
     * Updates local styles configuration depending on specified viewport. If viewport not specified, the style gets applied to all viewports.
     * @param pluginBag Local styles object.
     * @param pluginName Name of the style plugin, e.g. "background".
     * @param pluginConfig Style plugin configuration object.
     * @param viewport Requested viewport. If viewport not specified, the style gets applied to all viewports.
     */
    public static setPluginConfig(pluginBag: PluginBag, pluginName: string, pluginConfig: StylePluginConfig, viewport?: string): void {
        if (!pluginBag) {
            throw new Error(`Parameter "pluginBag" not specified.`);
        }

        if (!pluginName) {
            throw new Error(`Parameter "pluginName" not specified.`);
        }

        if (pluginConfig === undefined) { // null is allowed, it means reset
            throw new Error(`Parameter "pluginConfig" not specified.`);
        }

        let plugin = Objects.getObjectAt(pluginName, pluginBag) || {};

        if (viewport) {
            plugin[viewport] = pluginConfig;
        }
        else {
            plugin = pluginConfig;
        }

        Objects.setValue(pluginName, pluginBag, plugin);

        if (!pluginBag.key) {
            pluginBag.key = Utils.randomClassName();
        }

        Objects.cleanupObject(pluginBag, true, true);
        // this.optimizePluginConfig(pluginBag);
    }

    public static optimizeProperty(pluginBag: PluginBag, property: string): void {
        if (!StyleHelper.isResponsive(pluginBag[property])) {
            return;
        }

        const result = Utils.optimizeBreakpoints(pluginBag[property]);
        pluginBag[property] = result;
    }

    public static optimizePluginConfig(pluginConfig: StylePluginConfig): void {
        if (!StyleHelper.isResponsive(pluginConfig)) {
            return;
        }

        const breakpoints = ["xs", "sm", "md", "lg", "xl"];
        const lastValues = {};

        for (const breakpoint of breakpoints) {
            const pluginBag = pluginConfig[breakpoint];

            if (!pluginBag) {
                continue;
            }

            const properties = Object.keys(pluginBag);

            for (const property of properties) {
                if (lastValues[property] === pluginBag[property]) {
                    delete pluginBag[property];
                }
                else {
                    lastValues[property] = pluginBag[property];
                }
            }

            if (Object.keys(pluginBag).length === 0) {
                delete pluginConfig[breakpoint];
            }
        }
    }

    public static style(localStyles: LocalStyles): StyleConfigurator {
        return new StyleConfigurator(localStyles);
    }

    private static isStringNumber(value: string): boolean {
        return /^\d*$/gm.test(value);
    }

    public static isValueEmpty(value: string | number): boolean {
        return value === null || value === undefined || value === "";
    }

    public static parseValue(value: string | number): string {
        if (value === null || value === undefined || value === "") {
            throw new Error(`Style rule value cannot be empty.`);
        }

        if (value === "auto" || value === "initial" || value === "inherit") {
            return value;
        }

        if (typeof value === "number" || StyleHelper.isStringNumber(value)) {
            return value + "px";
        }

        if (typeof value === "string") {
            return value;
        }

        throw new Error(`Unparsable value ${value}.`);
    }

    public static calculate(...sizes: Size[]): string {
        const calcExpr = new CalcExpression();
        calcExpr.members = sizes;
        return calcExpr.toString();
    }

    public static setVisibility(localStyles: LocalStyles, newViewportValue: string, viewport: string, viewManager: ViewManager): void {
        const displayStyle = localStyles?.instance?.display;

        const displayOptions = [
            { value: null, text: "(Inherit)" },
            { value: Display.Inline, text: "Visible" },
            { value: Display.None, text: "Hidden" }
        ];

        let otherValues = [];

        const newState = displayStyle ? Objects.clone(displayStyle) : {};
        newState[viewport] = newViewportValue;

        otherValues = Object.values(newState);

        const optionText = displayOptions.find(x => x.value === newViewportValue).text;

        if (otherValues.includes(Display.None) && !otherValues.includes(Display.Inline) && !otherValues.includes(Display.Block)) {
            viewManager.notifyError("Visibility", `Element should be set "Visible" on at least one other screen size, before you can set "${optionText}" on current one.`);
            return;
        }

        StyleHelper.setPluginConfigForLocalStyles(localStyles, "display", newViewportValue, viewport);
    }
}