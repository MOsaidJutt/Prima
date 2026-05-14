'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { FileUploader, UploadedFile } from '@/components/file-uploader'
import { useState } from 'react'

const schema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  contactName: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('PK'),
  postalCode: z.string().optional(),
  ntn: z.string().optional(),
  strn: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankBranch: z.string().optional(),
  iban: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED']).default('ACTIVE'),
  tier: z.enum(['GOLD', 'SILVER', 'BRONZE']).default('BRONZE'),
  creditLimit: z.coerce.number().min(0).default(0),
  paymentTerms: z.coerce.number().min(0).default(30),
  notes: z.string().optional(),
})

export type DistributorFormValues = z.infer<typeof schema>

interface DistributorFormProps {
  defaultValues?: Partial<DistributorFormValues>
  defaultAttachments?: UploadedFile[]
  onSubmit: (data: DistributorFormValues, attachments: UploadedFile[]) => Promise<void>
  submitting?: boolean
  submitLabel?: string
}

export function DistributorForm({
  defaultValues,
  defaultAttachments = [],
  onSubmit,
  submitting,
  submitLabel = 'Save Distributor',
}: DistributorFormProps) {
  const [attachments, setAttachments] = useState<UploadedFile[]>(defaultAttachments)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DistributorFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      country: 'PK',
      status: 'ACTIVE',
      tier: 'BRONZE',
      creditLimit: 0,
      paymentTerms: 30,
      ...defaultValues,
    },
  })

  function Field({
    name,
    label,
    required,
    type = 'text',
    placeholder,
  }: {
    name: keyof DistributorFormValues
    label: string
    required?: boolean
    type?: string
    placeholder?: string
  }) {
    return (
      <div className="space-y-1">
        <Label htmlFor={name}>
          {label}
          {required && ' *'}
        </Label>
        <Input id={name} type={type} placeholder={placeholder} {...register(name as never)} />
        {errors[name] && (
          <p className="text-destructive text-xs">{errors[name]?.message as string}</p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data, attachments))} className="space-y-6">
      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field name="companyName" label="Company Name" required />
          <Field name="contactName" label="Primary Contact" />
          <Field name="email" label="Email" type="email" />
          <Field name="phone" label="Phone" />
          <Field name="phone2" label="Phone 2" />
          <Field name="website" label="Website" />
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Address</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field name="address" label="Street Address" />
          </div>
          <Field name="city" label="City" />
          <Field name="state" label="State / Province" />
          <Field name="postalCode" label="Postal Code" />
          <div className="space-y-1">
            <Label>Country</Label>
            <Select value={watch('country')} onValueChange={(v) => setValue('country', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PK">Pakistan</SelectItem>
                <SelectItem value="IN">India</SelectItem>
                <SelectItem value="AE">UAE</SelectItem>
                <SelectItem value="US">United States</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tax IDs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tax & Legal</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field name="ntn" label="NTN" />
          <Field name="strn" label="STRN" />
        </CardContent>
      </Card>

      {/* Bank Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bank Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field name="bankName" label="Bank Name" />
          <Field name="bankAccount" label="Account Number" />
          <Field name="bankBranch" label="Branch" />
          <Field name="iban" label="IBAN" />
        </CardContent>
      </Card>

      {/* Business Terms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business Terms</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={watch('status')}
              onValueChange={(v) => setValue('status', v as 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="BLACKLISTED">Blacklisted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tier</Label>
            <Select
              value={watch('tier')}
              onValueChange={(v) => setValue('tier', v as 'GOLD' | 'SILVER' | 'BRONZE')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GOLD">Gold</SelectItem>
                <SelectItem value="SILVER">Silver</SelectItem>
                <SelectItem value="BRONZE">Bronze</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field name="creditLimit" label="Credit Limit (PKR)" type="number" />
          <Field name="paymentTerms" label="Payment Terms (days)" type="number" />
        </CardContent>
      </Card>

      {/* Notes & Attachments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes & Attachments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea {...register('notes')} placeholder="Internal notes…" rows={3} />
          </div>
          <Separator />
          <FileUploader
            value={attachments}
            onChange={setAttachments}
            uploadEndpoint="/api/v1/upload/attachment"
            label="Attach documents (contracts, certificates, etc.)"
            accept=".pdf,.doc,.docx,.jpg,.png"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
