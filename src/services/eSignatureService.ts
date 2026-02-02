import { supabase } from '@/integrations/supabase/client';

export const eSignatureService = {
  /**
   * Simulates sending a contract envelope via DocuSign/HelloSign
   */
  async sendEnvelope(contractId: string, recipientEmail: string) {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // In a real integration, this would call the provider's API
    // and store the envelope_id in the database
    
    const { error } = await supabase
      .from('vendor_contracts')
      .update({ 
        signature_status: 'sent'
      })
      .eq('id', contractId);
      
    if (error) throw error;
    
    return { 
      status: 'sent', 
      envelopeId: `env_${Math.random().toString(36).substring(7)}`,
      provider: 'Simulation (DocuSign/HelloSign)' 
    };
  },

  /**
   * Simulates the signer completing the document (webhook callback)
   */
  async simulateSigning(contractId: string, signerName: string) {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { error } = await supabase
      .from('vendor_contracts')
      .update({ 
        signature_status: 'signed',
        signed_at: new Date().toISOString(),
        signed_by: signerName
      })
      .eq('id', contractId);
      
    if (error) throw error;
    
    return { status: 'signed' };
  },

  /**
   * Simulates voiding/declining an envelope
   */
  async voidEnvelope(contractId: string, reason: string) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { error } = await supabase
      .from('vendor_contracts')
      .update({ 
        signature_status: 'declined'
      })
      .eq('id', contractId);
      
    if (error) throw error;
    
    return { status: 'declined', reason };
  }
};
