import { ReactElement, createElement } from "react";
import { FormRendererPreviewProps } from "../typings/FormRendererProps";

export function preview(props: FormRendererPreviewProps): ReactElement {
    return (
        <div style={{ padding: "10px", border: "1px dashed #ccc", textAlign: "center" }}>
            <b>Form Renderer</b>
            <p>Data Source: {props.fieldsDS ? "Configured" : "Not Configured"}</p>
        </div>
    );
}

export function getPreviewCss(): string {
    return require("./ui/FormRenderer.css");
}
