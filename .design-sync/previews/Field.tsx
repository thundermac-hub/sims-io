import {
  Field,
  FieldSet,
  FieldLegend,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldSeparator,
  FieldContent,
  FieldTitle,
  Input,
  Textarea,
  Checkbox,
} from "sims"

export const SupportForm = () => (
  <div className="w-[420px]">
    <FieldSet>
      <FieldLegend>Support request</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="sf-subject">Subject</FieldLabel>
          <Input id="sf-subject" defaultValue="POS terminal not syncing" />
          <FieldDescription>
            Keep it short — this becomes the ClickUp task title.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="sf-detail">What happened?</FieldLabel>
          <Textarea
            id="sf-detail"
            rows={3}
            defaultValue="Orders placed on terminal 2 aren't reaching the dashboard since this morning."
          />
        </Field>
      </FieldGroup>
    </FieldSet>
  </div>
)

export const Invalid = () => (
  <div className="w-[420px]">
    <Field data-invalid="true">
      <FieldLabel htmlFor="sf-email">Merchant email</FieldLabel>
      <Input id="sf-email" aria-invalid defaultValue="owner@" />
      <FieldError errors={[{ message: "Enter a valid email address." }]} />
    </Field>
  </div>
)

export const Horizontal = () => (
  <div className="w-[420px]">
    <Field orientation="horizontal">
      <Checkbox id="sf-notify" defaultChecked />
      <FieldContent>
        <FieldTitle>Email me on status changes</FieldTitle>
        <FieldDescription>
          Sends updates when this ticket moves stage.
        </FieldDescription>
      </FieldContent>
    </Field>
  </div>
)

export const Separated = () => (
  <div className="w-[420px]">
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="sf-a">Outlet name</FieldLabel>
        <Input id="sf-a" defaultValue="Jalan Ampang" />
      </Field>
      <FieldSeparator />
      <Field>
        <FieldLabel htmlFor="sf-b">Contact number</FieldLabel>
        <Input id="sf-b" defaultValue="+60 12-345 6789" />
      </Field>
    </FieldGroup>
  </div>
)
