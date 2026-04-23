/**
 * This file was generated from FormRenderer.xml
 * WARNING: All changes made to this file will be overwritten
 * @author Mendix Widgets Framework Team
 */
import { CSSProperties } from "react";
import { EditableValue, ListValue, ListActionValue, ListAttributeValue } from "mendix";
import { Big } from "big.js";

export interface FormRendererContainerProps {
    name: string;
    class: string;
    style?: CSSProperties;
    tabIndex?: number;
    fieldsDS: ListValue;
    fieldLabel: ListAttributeValue<string>;
    fieldValue: ListAttributeValue<string>;
    fieldType: ListAttributeValue<string>;
    fieldSession: ListAttributeValue<string>;
    linePos: ListAttributeValue<Big>;
    colPos: ListAttributeValue<Big>;
    fieldSize: ListAttributeValue<string>;
    tableRows?: ListAttributeValue<Big>;
    tableCols?: ListAttributeValue<Big>;
    tableConfig?: ListAttributeValue<string>;
    outputJSON?: EditableValue<string>;
    editMode: boolean;
    onEditAction?: ListActionValue;
    onDeleteAction?: ListActionValue;
    onChangeAction?: ListActionValue;
}

export interface FormRendererPreviewProps {
    /**
     * @deprecated Deprecated since version 9.18.0. Please use class property instead.
     */
    className: string;
    class: string;
    style: string;
    styleObject?: CSSProperties;
    readOnly: boolean;
    renderMode: "design" | "xray" | "structure";
    translate: (text: string) => string;
    fieldsDS: {} | { caption: string } | { type: string } | null;
    fieldLabel: string;
    fieldValue: string;
    fieldType: string;
    fieldSession: string;
    linePos: string;
    colPos: string;
    fieldSize: string;
    tableRows: string;
    tableCols: string;
    tableConfig: string;
    outputJSON: string;
    editMode: boolean;
    onEditAction: {} | null;
    onDeleteAction: {} | null;
    onChangeAction: {} | null;
}
